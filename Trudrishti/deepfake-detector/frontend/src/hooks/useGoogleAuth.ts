import { useEffect, useState, useRef } from 'react';

interface GoogleAuthHookOptions {
  clientId: string;
  onSuccess: (credential: string) => void;
  buttonParentId: string;
}

export function useGoogleAuth({ clientId, onSuccess, buttonParentId }: GoogleAuthHookOptions) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    // Check if script is already present
    const existingScript = document.getElementById('google-jssdk');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-jssdk';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError('Failed to load Google Sign-In SDK.');
    document.body.appendChild(script);

    return () => {
      // Keep script loaded globally
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !clientId || !buttonParentId) return;

    try {
      /* global google */
      // @ts-ignore
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (response?.credential) {
            onSuccess(response.credential);
          } else {
            setError('Google authentication failed. No token returned.');
          }
        },
        auto_select: false,
      });

      const parentEl = document.getElementById(buttonParentId);
      if (parentEl && !renderedRef.current) {
        // @ts-ignore
        google.accounts.id.renderButton(parentEl, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: parentEl.clientWidth || 320,
        });
        renderedRef.current = true;
      }
    } catch (err: any) {
      console.error('Error initializing Google GIS Client:', err);
      setError(err?.message || 'Error configuring Google Login.');
    }
  }, [scriptLoaded, clientId, buttonParentId, onSuccess]);

  return { scriptLoaded, error };
}
