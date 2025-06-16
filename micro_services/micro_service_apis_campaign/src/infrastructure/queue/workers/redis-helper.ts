// Helper para operações Redis mais complexas
import type { createClient } from "redis"

export class RedisHelper {
  constructor(private client: ReturnType<typeof createClient>) {}

  // Método para set com opções de forma compatível
  async setWithOptions(key: string, value: string, options: { EX?: number; NX?: boolean } = {}) {
    if (options.NX && options.EX) {
      // Usar SETNX seguido de EXPIRE
      const result = await this.client.setNX(key, value)
      if (result && options.EX) {
        await this.client.expire(key, options.EX)
      }
      return result
    } else if (options.EX) {
      // Usar SETEX
      await this.client.setEx(key, options.EX, value)
      return true
    } else if (options.NX) {
      // Usar SETNX
      return await this.client.setNX(key, value)
    } else {
      // SET normal
      await this.client.set(key, value)
      return true
    }
  }

  // Método para HSET com objeto de forma compatível
  async hSetObject(key: string, obj: Record<string, string>) {
    const promises = Object.entries(obj).map(([field, value]) => this.client.hSet(key, field, value))

    await Promise.all(promises)
  }

  // Método para verificar e definir lock atomicamente
  async acquireLock(lockKey: string, value: string, ttlSeconds: number): Promise<boolean> {
    console.log('Entrou para criar o lock');
    const result = await this.client.setNX(lockKey, value);
    console.log('Resultado da criação do lock', result);
    if (result) {
      console.log('Vamos criar o tempo de expiração');
      await this.client.expire(lockKey, ttlSeconds);
    }
    return result
  }

  // Método para liberar lock
  async releaseLock(lockKey: string): Promise<void> {
    await this.client.del(lockKey)
  }
}
