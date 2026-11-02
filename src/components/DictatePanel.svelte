<script>
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { draftSessionNote } from '../lib/assist/sessionDraft.js';

  let { ondraft } = $props();

  const LANGUAGES = [['en-GB', 'English'], ['ar-LB', 'العربية'], ['fr-FR', 'Français']];
  let text = $state('');
  let language = $state('en-GB');
  let listening = $state(false);
  let supported = $state(false);
  let interim = $state('');
  let message = $state('');
  let recognition;

  onMount(() => {
    supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    return () => recognition?.abort();
  });

  function toggle() {
    if (listening) { recognition?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Recognition();
    Object.assign(recognition, { lang: language, continuous: true, interimResults: true });
    recognition.onresult = event => {
      let pending = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const piece = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) text = `${text}${text && !/[.!?؟]$/.test(text) ? '. ' : text ? ' ' : ''}${piece[0]?.toUpperCase() ?? ''}${piece.slice(1)}`;
        else pending += piece;
      }
      interim = pending;
    };
    recognition.onerror = event => { message = event.error === 'not-allowed' ? 'Microphone access was blocked. Allow it in the browser, or type instead.' : 'Dictation stopped. You can keep typing.'; };
    recognition.onend = () => { listening = false; interim = ''; };
    message = '';
    recognition.start();
    listening = true;
  }

  function draft() {
    const result = draftSessionNote(text);
    if (!result.filled.length) { message = 'Say or type a few words about the session first.'; return; }
    message = '';
    ondraft(result);
  }
</script>

<section class="assist" aria-label="Dictate this note">
  <header class="assist-head">
    <span class="assist-mark"><Icon name="sparkle" size={19} stroke={2} /></span>
    <div class="grow"><strong>Dictate this note</strong><span>Speak or type what happened. Cedar drafts the fields below for you to check and sign.</span></div>
  </header>
  <div class="assist-body">
    <div class="row wrap" style="gap: 8px">
      {#if supported}
        <button class="btn" class:listening type="button" onclick={toggle} aria-pressed={listening}>
          <Icon name={listening ? 'stop' : 'mic'} size={16} />{listening ? 'Stop listening' : 'Start dictation'}
        </button>
        <select class="select" style="width: auto; height: 36px" aria-label="Dictation language" bind:value={language} disabled={listening}>
          {#each LANGUAGES as [code, label]}<option value={code}>{label}</option>{/each}
        </select>
        {#if listening}<span class="live"><span class="pulse"></span>Listening</span>{/if}
      {:else}
        <span class="faint" style="font-size: 12.5px">Voice dictation needs Chrome or Edge. Typing works everywhere.</span>
      {/if}
    </div>
    <textarea class="textarea" rows="4" bind:value={text} placeholder="For example: Attended. Talked about sleep and evening cravings. Denies self-harm. Next session we practise urge surfing." aria-label="Session notes in your own words"></textarea>
    {#if interim}<p class="faint" style="font-size: 13px; margin-top: -4px">{interim}…</p>{/if}
    <div class="row between wrap">
      <span class="faint" style="font-size: 12px">Preview of Cedar Assist. Drafted in this browser; nothing is sent anywhere.</span>
      <button class="btn dark" type="button" onclick={draft}><Icon name="sparkle" size={15} />Draft the note</button>
    </div>
    {#if message}<p class="error" role="status">{message}</p>{/if}
  </div>
</section>
