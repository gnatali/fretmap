import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';

const cible = document.getElementById('app');
if (!cible) throw new Error('Élément #app introuvable');

export default mount(App, { target: cible });
