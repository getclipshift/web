import { h, Component, render, createRef } from 'https://esm.sh/preact@10.12.1';
import htm from 'https://unpkg.com/htm@3.1.1?module';

import { NtfyClient } from './ntfy.js';
import { NostrClient } from './nostr.js';
import { Scrambler } from './crypto.js';

const html = htm.bind(h);

const BACKEND_TYPES = {
  nostr: 'nostr',
  ntfy: 'ntfy'
}

class Clip extends Component {
  constructor() {
    super();

    this.state = { status: 'Tap to copy' };
  }

  render({ client, contents, timestamp }) {
    return html`
    <div class="box"  onClick=${() => {
      navigator.clipboard.writeText(contents).then(() => {
        this.setState({ status: 'Copied!' });
        setTimeout(() => {
          this.setState({ status: 'Tap to copy' });
        }, 2000);
      });
    }}>
      <p>
        <strong>${client} </strong><small>${(new Date(timestamp)).toLocaleString()}</small>
        <br />
        <span style="overflow-wrap: break-word;">${contents.length > 140 ? `${contents.substring(0, 137)}...` : contents}</span>
        <br />
        <small>${this.state.status}</small>
      </p>
    </div>
    `;
  }
}

class Input extends Component {
  constructor() {
    super();
    this.state = {
      value: '',
      isHidden: null,
      labelOverride: '',
      placeholderOverride: ''
    };
  }

  render(props) {
    if (this.state.isHidden === null && props.hidden === true) this.state.isHidden = true;
    if (!this.state.value && props.value) this.state.value = props.value;
    return html`
    <div class="field${this.state.isHidden ? ' is-hidden' : ''}">
      <label class="label">${this.state.labelOverride || props.label}</label>
      <div class="control">
        <input class="input" type="${props.type || 'text'}"
          placeholder="${this.state.placeholderOverride || props.placeholder || ''}"
          value="${this.state.value}"
          onInput=${(e) => {
            this.state.value = e.target.value;
          }} />
      </div>
    </div>
    `;
  }
}

class Select extends Component {
  constructor() {
    super();
    this.state = { value: null, isHidden: null };
  }

  render(props) {
    if (this.state.value === null && props.selected) this.state.value = props.selected;
    if (typeof props?.options === 'object') props.options = Object.values(props.options);
    return html`
    <div class="field${this.state.isHidden ? ' is-hidden' : ''}">
      <label class="label">${props.label}</label>
      <div class="control">
        <div class="select">
          <select value=${this.state.value} onChange=${(e) => {
            this.setState({ value: e.target.value });
            if (props.callbackthis && props.callback) props.callback.call(props.callbackthis, e.target.value);
          }}>
            ${this.state.value ? '' : '<option value="None" />'}
            ${props.options.map(o => html`<option value=${o}>${o}</option>`)}
          </select>
        </div>
      </div>
    </div>
    `;
  }
}

class Settings extends Component {
  constructor() {
    super();

    this.clientRef = createRef();
    this.typeRef = createRef();
    this.hostRef = createRef();
    this.userRef = createRef();
    this.passRef = createRef();
    this.topicRef = createRef();
    this.encKeyRef = createRef();

    this.defaultClient = `clipshift-${(Math.random().toString(36)+'00000000000000000').slice(2, 10)}`;
  }

  render({ app }) {
    if (!this.app) this.app = app;
    return html`
    <div class="card${app.state.showSettings ? '' : ' is-hidden'}">
      <header class="card-header">
        <p class="card-header-title">Settings</p>
      </header>
      <div class="card-content">
        <${Input} label="Client Name" placeholder="Client name" value=${app.state.backend.client} ref=${this.clientRef} />
        <${Select} label="Backend Type" options=${BACKEND_TYPES} selected=${app.state.backend.type} callbackthis=${this} callback=${this.typeChanged} ref=${this.typeRef} />
        <${Input} label="Host URL" placeholder="${app.state.backend.type === BACKEND_TYPES.nostr ? 'wss://' : 'https://'}" value=${app.state.backend.host} ref=${this.hostRef} />
        <${Input} label="Username" placeholder="Username" value=${app.state.backend.user} ref=${this.userRef} />
        <${Input} label="Password" type="password" value=${app.state.backend.pass} ref=${this.passRef} />
        <${Input} label="Topic" placeholder="Topic" value=${app.state.backend.topic} hidden=${app.state.backend.type !== BACKEND_TYPES.ntfy} ref=${this.topicRef} />
        <${Input} label="Encryption Key" type="password" value=${app.state.backend.encryptionkey} hidden=${app.state.backend.type !== BACKEND_TYPES.ntfy} ref=${this.encKeyRef} />
      </div>
      <footer class="card-footer">
        <button class="button is-success m-2" onClick=${() => {
          const backend = {
            client: this.clientRef.current.state.value,
            type: this.typeRef.current.state.value,
            host: this.hostRef.current.state.value
          };
          // Backend-specific options
          switch (backend.type) {
            case BACKEND_TYPES.nostr:
              // No user
              break;
            case BACKEND_TYPES.ntfy:
              if (this.topicRef.current.state.value) backend.topic = this.topicRef.current.state.value;
              if (this.encKeyRef.current.state.value) backend.encryptionkey = this.encKeyRef.current.state.value;
            default:
              if (this.userRef.current.state.value) backend.user = this.userRef.current.state.value;
              break;
          }
          if (this.passRef.current.state.value) backend.pass = this.passRef.current.state.value;
          app.setState({ backend, showSettings: false });
          app.connectToBackend(backend);
          localStorage.setItem('clipshift-config', JSON.stringify({ backend }));
        }}>Save</button>
        <button class="button my-2" onClick=${() => {
          app.setState({ showSettings: false });
          this.resetFieldValues();
        }}>Cancel</button>
      </footer>
    </div>
    `;
  }

  componentDidMount() {
    this.resetFieldValues();
  }

  resetFieldValues() {
    this.clientRef.current.state.value = this.app.state.backend.client || this.defaultClient;
    this.typeRef.current.state.value = this.app.state.backend.type || 'None';
    this.hostRef.current.state.value = this.app.state.backend.host || '';
    this.userRef.current.state.value = this.app.state.backend.user || '';
    this.passRef.current.state.value = this.app.state.backend.pass || '';
    this.topicRef.current.state.value = this.app.state.backend.topic || '';
    this.encKeyRef.current.state.value = this.app.state.backend.encryptionkey || '';
    this.typeChanged(this.app.state.backend.type);
  }

  typeChanged(t) {
    switch (t) {
      case BACKEND_TYPES.nostr:
        this.userRef.current.setState({ isHidden: true });
        this.topicRef.current.setState({ isHidden: true });
        this.passRef.current.setState({ labelOverride: 'Private Key' });
        this.encKeyRef.current.setState({ isHidden: true });
        break;
      case BACKEND_TYPES.ntfy:
        this.topicRef.current.setState({ isHidden: false });
        this.encKeyRef.current.setState({ isHidden: false });
      default:
        this.userRef.current.setState({ isHidden: false });
        this.passRef.current.setState({ labelOverride: 'Password' });
        break;
    }
  }
}

class Backend extends Component {
  render({ app }) {
    return html`
    <div class="box${app.state.showSettings ? ' is-hidden' : ''}" onClick=${() => app.setState({ showSettings: true })}>
      <p>
        <strong>Backend</strong><small> ${app.state.backend.type}</small>
        <br/>
        ${app.state.backend.type !== 'None' ? html`<span>${app.state.backend.host}</span><br/>` : ''}
        <small>Tap to configure</small>
      </p>
    </div>`;
  }
}

class App extends Component {
  constructor() {
    super();
    const stored = JSON.parse(localStorage.getItem('clipshift-config') || '{"backend":{"type":"None"}}');
    this.state = {
      ...stored,
      showSettings: false,
      client: null,
      clips: []
    }
    this.connectToBackend();
  }

  render() {
    return html`
    <div>
      <p class="title is-1 has-text-centered has-text-light mt-4">⬆️ clipshift</p>

      <${Settings} app=${this} />
      <${Backend} app=${this} />
      
      ${this.state.client !== null ? html`<button class="button is-warning mt-2 is-centered"
        onClick=${async () => {
          try {
            let clip = await navigator.clipboard.readText();
            if (this.state.backend.encryptionkey) {
                clip = await this.state.scrambler.encrypt(clip);
            }
            this.state.client.sendClip(clip);
          } catch (e) {
            console.dir(e);
          }
        }}>Send Clipboard</button>` : ''}
      <hr />
      ${this.state.clips.length > 0 ?
        this.state.clips.map(c => html`<${Clip} client=${c.client} contents=${c.contents} timestamp=${c.timestamp} />`)
        : 'Future clipboard pushes will show here'}
    </div>`;
  }

  connectToBackend(opts) {
    if (!opts) opts = this.state.backend;
    if (this.state.client) this.state.client.close();
    if (!opts.type || opts.type === 'None' || !opts.host) {
      this.state.client = null;
      return;
    }
    switch (opts.type) {
      case BACKEND_TYPES.nostr:
        this.setState({ client: new NostrClient(this, opts.client, opts.host, opts.pass) });
        break;
      case BACKEND_TYPES.ntfy:
        const newState = { client: new NtfyClient(this, opts.client, opts.host, opts.topic, opts.user, opts.pass) };
        if (opts.encryptionkey) newState.scrambler = new Scrambler(opts.encryptionkey);
        this.setState(newState);
        break;
    }
  }

  clipReceived(client, contents) {
    if (client !== this.state.backend.client) {
      this.state.clips = [{ client, contents, timestamp: Date.now()}, ...this.state.clips];
      if (this.state.clips.length > 10) this.state.clips = this.state.clips.slice(0, 10);
      this.setState({ clips: this.state.clips });
    }
  }
}

render(html`<${App} />`, document.getElementById('app'));
