# Chat Message Encryption

All chat messages stored in the database are encrypted at rest to ensure data privacy and security. This encryption is mandatory and complies with the EU AI Act requirements for data protection in AI systems.

When multi-instance caching uses Redis (`Cache__Provider=redis`), short-lived cross-replica `/converse` pending-result payloads written to Redis are also encrypted with the same conversation message key before storage. Completion signals over Redis pub/sub carry only the request id, not message body content. See [Scaling — Server replicas + Redis](scaling.md#server-replicas--redis).

## Encryption Overview

The system uses AES encryption to secure all conversation messages before storing them in the database. Each message is encrypted using a combination of:

- A base secret key for foundational encryption
- A unique conversation message key for additional security layers

This dual-key approach ensures that even if one key is compromised, the data remains protected.

## EU AI Act Compliance

Under the EU AI Act, AI systems that process personal data must implement appropriate technical and organizational measures to ensure data protection. Message encryption is a critical requirement for:

- **Data Minimization**: Only encrypted data is stored, limiting exposure
- **Security by Design**: Encryption is built into the system architecture
- **Data Protection**: Personal conversations are protected against unauthorized access
- **Transparency**: Users can be assured their messages are encrypted

## Environment Configuration

**Important**: The encryption keys must be configured in your environment before the system can encrypt and store messages. Without proper key configuration, the system cannot function securely.

### Required Environment Variables

Configure the following encryption keys in your environment:

```.env
# Base encryption secret - use a long, random string (minimum 32 characters)
EncryptionKeys__BaseSecret=<LONG_RANDOM_BASE_SECRET>

# Conversation message encryption key - unique secret for chat messages
EncryptionKeys__UniqueSecrets__ConversationMessageKey=<UNIQUE_SECRET_FOR_MESSAGES>
```

### Key Generation Guidelines

- **Base Secret**: Generate a cryptographically secure random string of at least 32 characters
- **Message Key**: Use a different random string, also minimum 32 characters
- **Security**: Never reuse keys across different environments (dev/staging/prod)
- **Storage**: Store keys securely using your organization's secret management system

### Example Configuration

```bash
# Generate secure keys (Linux/macOS)
openssl rand -base64 32

# Example .env configuration
EncryptionKeys__BaseSecret=YourSecureBase64EncodedSecretKeyHere123456789
EncryptionKeys__UniqueSecrets__ConversationMessageKey=AnotherSecureRandomKeyForMessages987654321
```

## Security Considerations

- **Key Rotation**: Regularly rotate encryption keys according to your security policy
- **Access Control**: Limit access to encryption keys to authorized personnel only
- **Backup**: Ensure encryption keys are included in your secure backup procedures
- **Monitoring**: Monitor for any unauthorized access attempts to encrypted data
- **Redis multi-instance**: Keep Redis network-isolated with AUTH and TLS. Pending `/converse` result keys are encrypted with `ConversationMessageKey`, but Redis remains a trusted control plane for cache invalidation (see [Scaling — Server replicas + Redis](scaling.md#server-replicas--redis))

## Troubleshooting

**"Encryption keys not configured"**: Ensure both `BaseSecret` and `ConversationMessageKey` are set in your environment

**"Unable to decrypt messages"**: Verify that the same encryption keys used to encrypt the data are being used for decryption

**"Key format invalid"**: Ensure keys are properly base64 encoded and meet minimum length requirements
