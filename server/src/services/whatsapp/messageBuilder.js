class MessageBuilder {
  constructor({ to, messagingProduct = 'whatsapp', defaultCountryCode = '91' } = {}) {
    const normalizedTo = MessageBuilder.normalizePhone(to, defaultCountryCode);
    if (!normalizedTo) throw new Error('Recipient phone is required');

    this.defaultCountryCode = defaultCountryCode;
    this.messageType = null;
    this.requires24hWindow = false;

    this.payload = {
      messaging_product: messagingProduct,
      recipient_type: 'individual',
      to: normalizedTo
    };
  }

  static normalizePhone(phone, defaultCountryCode = '91') {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `${defaultCountryCode}${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `${defaultCountryCode}${digits.slice(1)}`;
    return digits;
  }

  text(body) {
    if (!body || !String(body).trim()) throw new Error('Text body required');
    this.messageType = 'text';
    this.requires24hWindow = true;
    this.payload.type = 'text';
    this.payload.text = { body: String(body).trim() };
    return this;
  }

  image({ link, id, caption } = {}) {
    if (!link && !id) throw new Error('Image link or id required');
    this.messageType = 'image';
    this.requires24hWindow = true;
    this.payload.type = 'image';
    this.payload.image = {};
    if (link) this.payload.image.link = link;
    if (id) this.payload.image.id = id;
    if (caption) this.payload.image.caption = caption;
    return this;
  }

  video({ link, id, caption } = {}) {
    if (!link && !id) throw new Error('Video link or id required');
    this.messageType = 'video';
    this.requires24hWindow = true;
    this.payload.type = 'video';
    this.payload.video = {};
    if (link) this.payload.video.link = link;
    if (id) this.payload.video.id = id;
    if (caption) this.payload.video.caption = caption;
    return this;
  }

  audio({ link, id } = {}) {
    if (!link && !id) throw new Error('Audio link or id required');
    this.messageType = 'audio';
    this.requires24hWindow = true;
    this.payload.type = 'audio';
    this.payload.audio = {};
    if (link) this.payload.audio.link = link;
    if (id) this.payload.audio.id = id;
    return this;
  }

  document({ link, id, filename, caption } = {}) {
    if (!link && !id) throw new Error('Document link or id required');
    this.messageType = 'document';
    this.requires24hWindow = true;
    this.payload.type = 'document';
    this.payload.document = {};
    if (link) this.payload.document.link = link;
    if (id) this.payload.document.id = id;
    if (filename) this.payload.document.filename = filename;
    if (caption) this.payload.document.caption = caption;
    return this;
  }

  location({ latitude, longitude, name, address } = {}) {
    if (latitude === undefined || longitude === undefined) {
      throw new Error('Latitude and longitude required');
    }

    this.messageType = 'location';
    this.requires24hWindow = true;
    this.payload.type = 'location';
    this.payload.location = { latitude, longitude };
    if (name) this.payload.location.name = name;
    if (address) this.payload.location.address = address;
    return this;
  }

  contact(contacts) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new Error('Contacts must be a non-empty array');
    }

    this.messageType = 'contacts';
    this.requires24hWindow = true;
    this.payload.type = 'contacts';
    this.payload.contacts = contacts;
    return this;
  }

  reaction({ messageId, emoji } = {}) {
    if (!messageId || !emoji) throw new Error('Message ID and emoji required');
    this.messageType = 'reaction';
    this.requires24hWindow = true;
    this.payload.type = 'reaction';
    this.payload.reaction = { message_id: messageId, emoji };
    return this;
  }

  buttons({ bodyText, buttons } = {}) {
    if (!bodyText || !Array.isArray(buttons) || buttons.length === 0) {
      throw new Error('Body text and buttons are required');
    }

    if (buttons.length > 3) {
      throw new Error('WhatsApp supports maximum 3 reply buttons');
    }

    this.messageType = 'interactive.button';
    this.requires24hWindow = true;
    this.payload.type = 'interactive';
    this.payload.interactive = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title }
        }))
      }
    };

    return this;
  }

  list({ bodyText, buttonText, sections } = {}) {
    if (!bodyText || !buttonText || !Array.isArray(sections) || sections.length === 0) {
      throw new Error('Body text, button text, and sections are required');
    }

    this.messageType = 'interactive.list';
    this.requires24hWindow = true;
    this.payload.type = 'interactive';
    this.payload.interactive = {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections }
    };

    return this;
  }

  flow({ flowId, flowToken = 'default' } = {}) {
    if (!flowId) throw new Error('Flow ID required');

    this.messageType = 'interactive.flow';
    this.requires24hWindow = true;
    this.payload.type = 'interactive';
    this.payload.interactive = {
      type: 'flow',
      action: {
        flow_id: flowId,
        flow_token: flowToken
      }
    };

    return this;
  }

  template({ name, language = 'en', components = [] } = {}) {
    if (!name) throw new Error('Template name required');

    this.messageType = 'template';
    this.requires24hWindow = false;
    this.payload.type = 'template';
    this.payload.template = {
      name,
      language: { code: language },
      components
    };

    return this;
  }

  enforce24HourWindow(isWithin24h) {
    if (this.requires24hWindow && !isWithin24h) {
      throw new Error('Session window expired. Use template.');
    }
    return this;
  }

  validate() {
    if (!this.payload.type) throw new Error('Message type not defined');
    if (!this.payload.to) throw new Error('Recipient phone is required');
  }

  build({ isWithin24h = true } = {}) {
    this.enforce24HourWindow(isWithin24h);
    this.validate();
    return this.payload;
  }
}

module.exports = MessageBuilder;
