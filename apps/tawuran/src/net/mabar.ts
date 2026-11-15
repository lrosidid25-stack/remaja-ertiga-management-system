/**
 * Transport Mabar Online (duel 1v1) memakai Supabase Realtime broadcast.
 *
 * Kenapa Realtime (bukan WebRTC P2P): operator seluler di Indonesia banyak yang
 * memakai CGNAT sehingga koneksi P2P sering gagal. Realtime hanya butuh
 * WebSocket keluar, jadi tetap nyambung walau kedua HP di jaringan berbeda.
 *
 * Mode lain (tawuran gelombang, offline) sama sekali tidak memakai modul ini.
 */

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  MABAR_PEER_TIMEOUT,
  MABAR_PING_INTERVAL,
  channelNameFor,
  parseMabarMessage,
  serializeMabarMessage,
  toWireMessage,
  type MabarMessage,
  type MabarProfile,
} from './mabar-protocol';

/** Proyek Supabase milik aplikasi ini (anon key memang publik, hanya untuk Realtime). */
export const MABAR_SUPABASE_URL = 'https://rilnglxfbbzmxvmxlsjm.supabase.co';
export const MABAR_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbG5nbHhmYmJ6bXh2bXhsc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDkzNDYsImV4cCI6MjA5OTYyNTM0Nn0.5enZLSKSQKObC45d7NhkqbP35aR63wVNIgrigCi66w8';

export type MabarRole = 'host' | 'guest';

export type MabarStatus =
  | 'connecting'
  | 'waiting'
  | 'ready'
  | 'peer-left'
  | 'error';

export interface MabarSessionOptions {
  code: string;
  role: MabarRole;
  profile: MabarProfile;
  onMessage: (msg: MabarMessage) => void;
  onStatus: (status: MabarStatus, detail?: string) => void;
  onPeerProfile: (profile: MabarProfile) => void;
}

const BROADCAST_EVENT = 'mabar';
const JOIN_TIMEOUT_MS = 12000;

export class MabarSession {
  readonly code: string;
  readonly role: MabarRole;

  private readonly opts: MabarSessionOptions;
  private client: SupabaseClient;
  private channel: RealtimeChannel;
  private closed = false;
  private subscribed = false;
  private ready = false;
  private peerLeftAnnounced = false;
  private lastPeerAt = 0;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private queue: MabarMessage[] = [];

  constructor(opts: MabarSessionOptions) {
    this.opts = opts;
    this.code = opts.code.toUpperCase();
    this.role = opts.role;

    this.client = createClient(MABAR_SUPABASE_URL, MABAR_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 24 } },
    });

    this.channel = this.client.channel(channelNameFor(this.code), {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: `${opts.role}-${Math.random().toString(36).slice(2, 8)}` },
      },
    });
  }

  async start(): Promise<void> {
    this.opts.onStatus('connecting');

    this.channel.on('broadcast', { event: BROADCAST_EVENT }, (payload) => {
      this.handleIncoming((payload as { payload?: { m?: unknown } })?.payload?.m);
    });

    this.joinTimer = setTimeout(() => {
      if (this.closed || this.ready) return;
      this.opts.onStatus(
        'error',
        'Room tidak merespons. Cek internet HP, lalu coba lagi.',
      );
      this.close();
    }, JOIN_TIMEOUT_MS);

    await new Promise<void>((resolve) => {
      this.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.subscribed = true;
          this.flushQueue();
          // Tuan rumah boleh menunggu tamu selama apa pun; batas waktu hanya
          // untuk yang bergabung (kode salah / room tidak ada).
          if (this.role === 'host' && this.joinTimer) {
            clearTimeout(this.joinTimer);
            this.joinTimer = null;
          }
          this.opts.onStatus(this.role === 'host' ? 'waiting' : 'connecting');
          if (this.role === 'guest') {
            this.sendRaw({ t: 'hi', p: this.opts.profile });
          }
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!this.closed && !this.ready) {
            this.opts.onStatus(
              'error',
              'Gagal menyambung ke server mabar. Periksa internet lalu coba lagi.',
            );
            this.close();
          }
          resolve();
        }
      });
    });

    this.pingTimer = setInterval(() => {
      if (this.closed) return;
      this.send({ t: 'ping' });
    }, MABAR_PING_INTERVAL * 1000);

    this.watchdogTimer = setInterval(() => {
      if (this.closed || !this.ready || this.peerLeftAnnounced) return;
      if (Date.now() - this.lastPeerAt > MABAR_PEER_TIMEOUT * 1000) {
        this.peerLeftAnnounced = true;
        this.opts.onStatus('peer-left', 'Temanmu terputus.');
      }
    }, 1500);
  }

  send(msg: MabarMessage): void {
    if (this.closed) return;
    if (!this.subscribed) {
      // Simpan pesan penting saat handshake, buang state supaya tidak menumpuk.
      if (msg.t !== 's' && msg.t !== 'ping') this.queue.push(msg);
      return;
    }
    this.sendRaw(msg);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.joinTimer) clearTimeout(this.joinTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.joinTimer = null;
    this.pingTimer = null;
    this.watchdogTimer = null;
    try {
      if (this.ready) this.sendRaw({ t: 'bye' });
    } catch {
      // Best effort
    }
    try {
      void this.client.removeChannel(this.channel);
    } catch {
      // Best effort
    }
    void this.client.removeAllChannels?.();
  }

  private sendRaw(msg: MabarMessage): void {
    try {
      void this.channel.send({
        type: 'broadcast',
        event: BROADCAST_EVENT,
        payload: { m: toWireMessage(msg) },
      });
    } catch {
      // Abaikan: watchdog akan menandai kalau koneksi benar-benar putus.
    }
  }

  private flushQueue(): void {
    const pending = this.queue;
    this.queue = [];
    pending.forEach((msg) => this.sendRaw(msg));
  }

  private handleIncoming(raw: unknown): void {
    if (this.closed) return;
    const msg = parseMabarMessage(typeof raw === 'string' ? raw : JSON.stringify(raw));
    if (!msg) return;

    if (msg.t === 'bye') {
      if (!this.peerLeftAnnounced) {
        this.peerLeftAnnounced = true;
        this.opts.onStatus('peer-left', 'Temanmu keluar dari room.');
      }
      return;
    }

    this.lastPeerAt = Date.now();

    switch (msg.t) {
      case 'hi': {
        this.markReady();
        this.opts.onPeerProfile(msg.p);
        this.send({ t: 'we', p: this.opts.profile });
        return;
      }
      case 'we': {
        this.markReady();
        this.opts.onPeerProfile(msg.p);
        return;
      }
      case 'pong':
        return;
      case 'ping':
        this.send({ t: 'pong' });
        return;
      default:
        if (!this.ready) return;
        this.opts.onMessage(msg);
        return;
    }
  }

  private markReady(): void {
    if (this.ready) return;
    this.ready = true;
    if (this.joinTimer) clearTimeout(this.joinTimer);
    this.joinTimer = null;
    this.lastPeerAt = Date.now();
    this.opts.onStatus('ready');
  }
}

/** Ekspor untuk keperluan debug/nama channel di UI. */
export function roomChannelName(code: string): string {
  return channelNameFor(code);
}

export { serializeMabarMessage };
