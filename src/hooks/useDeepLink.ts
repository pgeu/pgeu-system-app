/**
 * React hook for deep link handling
 * Integrates deep link service with conference store
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { deepLinkService } from '../services/deepLinkService';
import { useConferenceStore } from '../store/conferenceStore';

export interface UseDeepLinkOptions {
  /**
   * Whether to navigate to conferences page after successful deep link
   * Default: true
   */
  navigateOnSuccess?: boolean;

  /**
   * Whether to check for launch URL on mount
   * Default: true
   */
  checkLaunchUrl?: boolean;
}

/**
 * Hook to handle deep links for conference URLs
 * Automatically sets up listeners and processes URLs
 */
export function useDeepLink(options: UseDeepLinkOptions = {}) {
  const {
    navigateOnSuccess = true,
    checkLaunchUrl = true,
  } = options;

  const navigate = useNavigate();
  const addConferenceFromUrl = useConferenceStore(state => state.addConferenceFromUrl);
  // Read through refs so that a new navigate() (which react-router hands out
  // on every location change) doesn't tear down and re-register the listener
  const latest = useRef({ navigate, addConferenceFromUrl, navigateOnSuccess });
  const checkLaunchUrlRef = useRef(checkLaunchUrl);

  useEffect(() => {
    latest.current = { navigate, addConferenceFromUrl, navigateOnSuccess };
  }, [navigate, addConferenceFromUrl, navigateOnSuccess]);

  useEffect(() => {
    // Handler function for deep links
    const handleDeepLink = async (url: string): Promise<boolean> => {
      try {
        const { addConferenceFromUrl, navigate, navigateOnSuccess } = latest.current;
        const success = await addConferenceFromUrl(url);

        if (success && navigateOnSuccess) {
          // Navigate to conferences page after successful addition
          navigate('/conferences');
        }

        return success;
      } catch (error) {
        console.error('Error handling deep link:', error);
        return false;
      }
    };

    // Initialize deep link service
    deepLinkService.initialize(handleDeepLink);

    // Check for launch URL if app was opened with one
    // (the service only processes it once, so StrictMode's remount is safe)
    if (checkLaunchUrlRef.current) {
      deepLinkService.checkLaunchUrl(handleDeepLink).catch(error => {
        console.error('Error checking launch URL:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      deepLinkService.destroy();
    };
  }, []);
}
