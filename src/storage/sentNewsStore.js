import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export class SentNewsStore {
  constructor(filePath = config.sentNewsFile) {
    this.filePath = path.resolve(filePath);
    this.sent = new Map();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed.sent) ? parsed.sent : [];

      this.sent.clear();
      for (const entry of entries) {
        if (entry?.id) {
          this.sent.set(entry.id, entry);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Could not load sent news store:', error.message);
      }
      this.sent.clear();
    }
  }

  has(id) {
    return this.sent.has(id);
  }

  async markAsSent(item) {
    const entry = {
      source: item.source,
      id: item.id,
      title: item.title,
      url: item.url,
      sentAt: new Date().toISOString()
    };

    this.sent.set(item.id, entry);
    await this.save();
  }

  async save() {
    const payload = {
      sent: [...this.sent.values()].slice(-500)
    };

    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
