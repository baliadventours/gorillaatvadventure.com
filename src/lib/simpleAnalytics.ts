import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface SimplePageView {
  path: string;
  referrer: string;
  userAgent: string;
  sessionId: string;
  keywords: string;
  timestamp: string;
}

// Get or create a session ID stored in sessionStorage to identify unique browsing sessions
export const getSessionId = (): string => {
  let sessId = sessionStorage.getItem('simple_analytics_session_id');
  if (!sessId) {
    sessId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    sessionStorage.setItem('simple_analytics_session_id', sessId);
  }
  return sessId;
};

// Log simple pageview to Firestore
export const logSimplePageView = async (path: string) => {
  // Filter out any admin, supplier, or agent panel visits so that internal staff interactions
  // do not pollute public marketing conversion and guest visitor statistics.
  if (
    path.startsWith('/admin') ||
    path.startsWith('/supplier') ||
    path.startsWith('/agent') ||
    path.startsWith('/login')
  ) {
    return;
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const keywords = searchParams.get('q') || 
                     searchParams.get('query') || 
                     searchParams.get('utm_term') || 
                     searchParams.get('keywords') || 
                     searchParams.get('s') || 
                     '';

    let referrerStr = document.referrer || 'Direct / Bookmark';
    // Clean up internal referrers to make reports cleaner
    if (referrerStr.includes(window.location.host)) {
      referrerStr = 'Internal Navigation';
    }

    const payload: SimplePageView = {
      path,
      referrer: referrerStr,
      userAgent: navigator.userAgent,
      sessionId: getSessionId(),
      keywords: keywords.trim(),
      timestamp: new Date().toISOString()
    };

    const ref = collection(db, 'analytics_pageviews');
    await addDoc(ref, payload);
  } catch (error) {
    console.warn('[Simple Analytics] Logging skipped or offline:', error);
  }
};
