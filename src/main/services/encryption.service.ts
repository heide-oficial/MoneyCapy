import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'crypto'

interface EncryptedField {
  ciphertext: string
  iv: string
  tag: string
}

class EncryptionServiceClass {
  private sessionKey: Buffer | null = null
  private readonly ITERATIONS = 100000
  private readonly KEY_LENGTH = 32
  private readonly DIGEST = 'sha512'

  isUnlocked(): boolean {
    return this.sessionKey !== null
  }

  hashPassword(password: string, salt: string): string {
    return pbkdf2Sync(password, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST).toString('base64')
  }

  generateSalt(): string {
    return randomBytes(32).toString('base64')
  }

  unlock(password: string, encryptionSalt: string): void {
    this.sessionKey = pbkdf2Sync(password, encryptionSalt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST)
  }

  lock(): void {
    this.sessionKey = null
  }

  encrypt(plaintext: string): EncryptedField {
    if (!this.sessionKey) {
      throw new Error('Encryption service is locked. Unlock with password first.')
    }
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', this.sessionKey, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64')
    }
  }

  decrypt(field: EncryptedField): string {
    if (!this.sessionKey) {
      throw new Error('Encryption service is locked. Unlock with password first.')
    }
    if (!field.ciphertext || !field.iv || !field.tag) {
      return ''
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.sessionKey,
      Buffer.from(field.iv, 'base64')
    )
    decipher.setAuthTag(Buffer.from(field.tag, 'base64'))
    let decrypted = decipher.update(field.ciphertext, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}

export const EncryptionService = new EncryptionServiceClass()
