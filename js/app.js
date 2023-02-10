
import { el, list, mount, setAttr, setChildren, unmount } from "https://redom.js.org/redom.es.min.js";

const BACKEND_TYPES = {
  nostr: 'nostr',
  ntfy: 'ntfy'
}

let CLIPS = [];

class NtfyClient {
  constructor(client, host, topic, user, pass) {
    this.client = client;
    let authPart = '';
    if (user && pass) {
      const header = `Basic ${window.btoa(`${user}:${pass}`)}`;
      authPart = '?auth=' + window.btoa(header).replace(/=+$/g, '');
    }
    this.subUrl = `${host}/${topic}/sse${authPart}`;
    this.postUrl = `${host}/${topic}${authPart}`;

    this.eventSource = new EventSource(this.subUrl);
    this.eventSource.onmessage = this.handleEvent;
  }

  handleEvent(e) {
    const message = JSON.parse(e.data);
    if (message.title === this.client) return;
    addClip(message.title, message.message, Date.now());
  }

  sendClip(contents) {
    fetch(this.postUrl, {
      method: 'POST',
      body: contents,
      headers: {
        'Title': this.client,
        'Priority': 'min'
      }
    })
  }

  close() { this.eventSource.close(); }
}

class Input {
  constructor(label, options) {
    const defaultOptions = {
      type: 'text',
      placeholder: label
    };
    const mergedOptions = {...defaultOptions, ...options};
    this.el = el('div', { className: 'field' },
      this.label = el('label', { className: 'label' }, label),
      el('div', { className: 'control' },
        this.field = el('input', { className: 'input', type: mergedOptions.type, placeholder: mergedOptions.placeholder })
      )
    );
  }

  getValue() { return this.field.value; }
  setValue(value) { this.field.value = value; }
  setLabel(value) { this.label.textContent = value; }
  setType(value) { this.field.setAttribute('type', value); }
  disable() { this.field.setAttribute('disabled', ''); }
  enable() { this.field.removeAttribute('disabled'); }
}

class AddEditBackendModal {
  constructor() {
    this.data = {};

    this.title = el('p', { className: 'modal-card-title' });
    this.closeButton = el('button', { className: 'delete' });
    this.closeButton.onclick = () => { this.destroy() };

    this.typeSelect = el('select',
      el('option', { value: 'ntfy' }, 'ntfy'),
      el('option', { value: 'nostr' }, 'nostr')
    );

    this.saveButton = el('button', { className: 'button is-success' }, 'Save');
    this.saveButton.onclick = () => { this.save() };
    this.cancelButton = el('button', { className: 'button' }, 'Cancel');
    this.cancelButton.onclick = () => { this.destroy() };

    this.el = el('div', { className: 'modal' }, [
      el('div', { className: 'modal-background' }),
      el('div', { className: 'modal-card' }, [
        el('header', { className: 'modal-card-head' }, [
          this.title,
          this.closeButton
        ]),
        el('section', { className: 'modal-card-body' },
          this.clientInput = new Input('Client Name', 'Client Name', 'text'),
          el('div', { className: 'field' },
            el('label', { className: 'label' }, 'Type'),
            el('div', { className: 'control' },
              el('div', { className: 'select' }, this.typeSelect)
            )
          ),
          this.hostInput = new Input('Host'),
          this.userInput = new Input('Username'),
          this.passInput = new Input('Password', { type: 'password' }),
          this.topicInput = new Input('Topic', { placeholder: 'Ntfy Topic' })
        ),
        el('footer', { className: 'modal-card-foot' },
          this.saveButton,
          this.cancelButton
        )
      ])
    ]);

    this.typeSelect.onchange = () => {
      if (this.typeSelect.value === BACKEND_TYPES.nostr) {
        this.userInput.disable();
        this.topicInput.disable();
        this.passInput.setLabel('Private Key');
      } else {
        this.userInput.enable();
        this.topicInput.enable();
        this.passInput.setLabel('Password');
      }
    };
  }

  show(data) {
    mount(document.body, this.el);
    if (data.type) {
      this.title.textContent = 'Edit Backend';
      this.clientInput.setValue(data.client);
      this.typeSelect.value = data.type;
      this.hostInput.setValue(data.host);
      this.userInput.setValue(data.user);
      this.passInput.setValue(data.pass);
      this.topicInput.setValue(data.topic);
      if (data.type === BACKEND_TYPES.nostr) {
        this.userInput.disable();
        this.topicInput.disable();
        this.passInput.setLabel('Private Key');
      }
    } else {
      this.title.textContent = 'Add Backend';
      this.clientInput.setValue(`client-${(Math.random().toString(36)+'00000000000000000').slice(2, 10)}`);
    }
    this.el.classList.add('is-active');
  }

  hide() { this.el.classList.remove('is-active'); }

  destroy() {
    this.hide();
    unmount(document.body, this.el)
  }

  save() {
    app.saveBackend({
      client: this.clientInput.getValue(),
      type: this.typeSelect.value,
      host: this.hostInput.getValue(),
      user: this.userInput.getValue(),
      pass: this.passInput.getValue(),
      topic: this.topicInput.getValue()
    });
    this.destroy();
  }
}

class Backend {
  constructor() {
    this.client = null;
    this.data = {};

    this.backendType = el('small', 'None');
    this.backendHost = el('span');
    this.modal = new AddEditBackendModal();

    this.el = el('div', { className: 'box' },
      el('p',
        el('strong', 'Backend '),
        this.backendType,
        el('br'),
        el('small', 'Tap to configure')
      )
    );

    this.el.onclick = () => {
      this.modal.show(this.data);
    };
  }

  update(data) {
    this.data = data;
    this.backendType.textContent = data.type;
    this.backendHost.textContent = data.host;
    setChildren(this.el,
      el('p',
        el('strong', 'Backend '),
        this.backendType,
        el('br'),
        this.backendHost,
        el('br'),
        el('small', 'Tap to configure')
      )
    );

    if (this.client) {
      this.client.close();
    }

    switch (data.type) {
      case BACKEND_TYPES.ntfy:
        this.client = new NtfyClient(data.client, data.host, data.topic, data.user, data.pass);
        break;
    }
  }

  sendClip(contents) {
    if (this.client) {
      this.client.sendClip(contents);
    }
  }
}

class Clip {
  constructor(data) {
    this.data = data;

    this.copyButton = el('button', { className: 'button is-small is-dark mt-2' }, 'Copy');
    this.copyButton.onclick = () => { this.setClipboard() };

    this.el = el('div', { className: 'box' },
      el('p',
        this.client = el('strong'),
        this.timestamp = el('small'),
        el('br'),
        this.message = el('span'),
        el('br'),
        this.copyButton
      )
    );
  }

  update(data) {
    this.data = data;
    this.client.textContent = data.client + ' ';
    this.timestamp.textContent = `${(new Date(data.timestamp)).toLocaleString()}`;
    this.message.textContent = data.message;
    if (data.client === 'Info') {
      this.copyButton.classList.add('is-hidden');
    } else {
      this.copyButton.classList.remove('is-hidden');
    }
  }

  setClipboard() {
    navigator.clipboard.writeText(this.data.message).then(() => {
      this.copyButton.textContent = 'Copied';
      setTimeout(() => {
        this.copyButton.textContent = 'Copy';
      }, 1000);
    });
  }
}

class App {
  constructor() {
    const storedData = localStorage.getItem('clipshift-config') || '{}';
    const parsed = JSON.parse(storedData);

    this.backend = new Backend(this);

    this.sendButton = el('button', { className: 'button is-warning mt-2 is-centered' }, 'Send Clipboard')
    this.sendButton.onclick = () => {
      navigator.clipboard.readText().then((clip) => {
        this.backend.sendClip(clip);
      });
    }

    this.el = el('div',
      this.backend,
      this.sendButton,
      el('hr'),
      this.clipStash = el('div', { className: 'mt-4' })
    );

    this.clips = list(this.clipStash, Clip);
    this.clips.update([{ client: 'Info', timestamp: Date.now(), message: 'Future clipboard updates will appear here' }]);

    this.update(parsed)
  }

  update(data) {
    this.data = data;
    localStorage.setItem('clipshift-config', JSON.stringify(this.data));

    if (this.data.backend) {
      this.backend.update(this.data.backend);
    }
  }

  saveBackend(data) {
    this.data.backend = data;
    this.update(this.data);
  }

  clipReceived() {
    this.clips.update(CLIPS)
  }
}

const app = new App();
mount(document.getElementById('app'), app);

function addClip(client, message, timestamp) {
  CLIPS = [{ client: client || '', message, timestamp: timestamp || Date.now()}, ...CLIPS];
  if (CLIPS.length > 10) CLIPS = CLIPS.slice(0, 10);
  app.clipReceived();
}
