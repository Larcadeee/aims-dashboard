import { useEffect } from 'react';

// Original pages all loaded the same Zapier chatbot script + a
// <zapier-interfaces-chatbot-embed> custom element. We replicate that
// here so every route still shows the chat popup.
const CHATBOT_ID = 'cmrp6znr200akg36lnxbq5l4l';
const SCRIPT_SRC =
  'https://interfaces.zapier.com/assets/web-components/zapier-interfaces/zapier-interfaces.esm.js';

export default function ZapierChat() {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;

    const script = document.createElement('script');
    script.type = 'module';
    script.async = true;
    script.src = SCRIPT_SRC;
    document.body.appendChild(script);
  }, []);

  return (
    <zapier-interfaces-chatbot-embed
      is-popup="true"
      chatbot-id={CHATBOT_ID}
    />
  );
}
