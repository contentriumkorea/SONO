import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Mini } from './Mini';
import './styles.css';
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('mini')?<Mini/>:<App/>);
