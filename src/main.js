import { mount } from 'svelte';
import App from './App.svelte';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/forms.css';
import './styles/assist.css';
import './styles/mobile.css';

mount(App, { target: document.getElementById('app') });
