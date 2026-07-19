// Google Analytics Service for Bali Adventours
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface GAEvent {
  action: string;
  category?: string;
  label?: string;
  value?: number;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Memory logging of GA events for the interactive demo preview list
export const recordedGAEvents: Array<{
  timestamp: string;
  type: 'pageview' | 'event';
  name: string;
  params: any;
}> = [];

// Helper to push to our interactive dashboard stream
const logToInteractiveStream = (type: 'pageview' | 'event', name: string, params: any) => {
  recordedGAEvents.unshift({
    timestamp: new Date().toLocaleTimeString(),
    type,
    name,
    params
  });
  
  // Keep last 50 events in buffer
  if (recordedGAEvents.length > 50) {
    recordedGAEvents.pop();
  }

  // Trigger a custom event so the UI can listen and refresh live
  window.dispatchEvent(new CustomEvent('ga-event-logged'));
};

export const getGAMeasurementId = (): string => {
  return localStorage.getItem('ga_measurement_id') || '';
};

export const getGACustomScript = (): string => {
  return localStorage.getItem('ga_custom_script') || '';
};

export const setGAMeasurementId = (id: string) => {
  if (id) {
    localStorage.setItem('ga_measurement_id', id);
    setupGATags(id);
  } else {
    localStorage.removeItem('ga_measurement_id');
  }
};

// Safely inject custom script HTML (including direct script tag code evaluation) in body
export const injectCustomScript = (htmlSnippet: string) => {
  if (!htmlSnippet) {
    const existingBlock = document.getElementById('ga-custom-script-injection');
    if (existingBlock) existingBlock.remove();
    return;
  }

  // Clear previous injected block if it exists
  const existingBlock = document.getElementById('ga-custom-script-injection');
  if (existingBlock) existingBlock.remove();

  // Create a wrapper element
  const container = document.createElement('div');
  container.id = 'ga-custom-script-injection';
  container.style.display = 'none';
  container.innerHTML = htmlSnippet;
  document.body.appendChild(container);

  // Extract all script tags and inject them manually so they execute correctly
  const scripts = container.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    const newScript = document.createElement('script');
    
    // Copy all attributes
    for (let j = 0; j < s.attributes.length; j++) {
      const attr = s.attributes[j];
      newScript.setAttribute(attr.name, attr.value);
    }
    
    // Copy content code inside script
    newScript.textContent = s.textContent;
    document.head.appendChild(newScript);
  }
  console.log('[Google Analytics] Injected raw script block successfully.');
};

// Low level runner to inject and configure GTAG tags
export const setupGATags = (measurementId: string) => {
  if (!measurementId) return;

  try {
    const existingScriptId = 'ga-gtag-script';
    let script = document.getElementById(existingScriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = existingScriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    } else {
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    }

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
    }

    // Configure tracking ID
    window.gtag('config', measurementId, {
      page_path: window.location.pathname + window.location.search,
      send_page_view: true
    });

    logToInteractiveStream('pageview', window.location.pathname, {
      title: document.title,
      measurementId
    });

    console.log(`[Google Analytics] Initialized GTAG with ID: ${measurementId}`);
  } catch (error) {
    console.error('[Google Analytics] GTAG setup error:', error);
  }
};

// Orchestrates both GTAG and raw HTML custom scripts, synchronizing with Firestore settings
export const initGA = async () => {
  // 1. Initial cached render
  const cachedId = getGAMeasurementId();
  const cachedScript = getGACustomScript();

  if (cachedId) {
    setupGATags(cachedId);
  }
  if (cachedScript) {
    injectCustomScript(cachedScript);
  }

  // 2. Fetch remote values from database
  try {
    const docRef = doc(db, 'settings', 'analytics');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const { measurementId = '', customScript = '' } = snap.data();

      // If remote values changed, save and re-inject
      if (measurementId !== cachedId) {
        localStorage.setItem('ga_measurement_id', measurementId);
        setupGATags(measurementId);
      }
      if (customScript !== cachedScript) {
        localStorage.setItem('ga_custom_script', customScript);
        injectCustomScript(customScript);
      }
    }
  } catch (error) {
    console.warn('[Google Analytics] Remote config sync postponed:', error);
  }
};

export const trackGAPageview = (path: string) => {
  const measurementId = getGAMeasurementId();
  if (!measurementId) return;

  try {
    if (window.gtag) {
      window.gtag('config', measurementId, {
        page_path: path,
        send_page_view: true
      });
    }
    
    logToInteractiveStream('pageview', path, {
      title: document.title,
      measurementId
    });
  } catch (error) {
    console.warn('[Google Analytics] Pageview track error:', error);
  }
};

export const trackGAEvent = (action: string, category: string = 'engagement', label?: string, value?: number) => {
  const measurementId = getGAMeasurementId();
  if (!measurementId) return;

  try {
    if (window.gtag) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }

    logToInteractiveStream('event', action, {
      category,
      label,
      value
    });
  } catch (error) {
    console.warn('[Google Analytics] Event track error:', error);
  }
};
