/**
 * Stats Page
 * Displays statistics for the active conference (admin only)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { helpCircleOutline, refreshCircle, close } from 'ionicons/icons';
import { useConferenceStore } from '../store/conferenceStore';
import { createApiClientFromConference } from '../utils/apiUrlBuilder';
import { StatsResponse, ApiError } from '../types/api';
import HelpModal from '../components/HelpModal';
import { helpContent } from '../content/helpContent';
import { useModal } from '../hooks/useModal';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';

const StatsPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const helpModal = useModal();

  const conferences = useConferenceStore(state => state.conferences);
  const activeConferenceId = useConferenceStore(state => state.activeConferenceId);

  const activeConference = useMemo(
    () => activeConferenceId
      ? conferences.find(c => c.id === activeConferenceId) || null
      : null,
    [conferences, activeConferenceId]
  );

  const loadStats = useCallback(async () => {
    if (!activeConference) {
      setError('No active conference selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[Stats] Active conference:', {
        mode: activeConference.mode,
        baseUrl: activeConference.baseUrl,
        eventSlug: activeConference.eventSlug,
        token: activeConference.token ? `${activeConference.token.substring(0, 10)}...` : 'missing',
        fieldId: activeConference.fieldId,
      });

      const apiClient = createApiClientFromConference(activeConference);
      const statsData = await apiClient.getStats();
      console.log('[Stats] Successfully loaded stats');
      setStats(statsData);
    } catch (err: unknown) {
      const error = err as ApiError;
      console.error('[Stats] Error loading stats:', err);

      // Provide more user-friendly error message for common cases
      if (error.type === 'not_found') {
        setError('Statistics are only available to superusers. Please log in with an admin account to view statistics.');
      } else {
        setError(error.message || 'Failed to load statistics');
      }
    } finally {
      setLoading(false);
    }
  }, [activeConference]);

  useEffect(() => {
    // Fetching on mount is the point of this effect; loadStats() sets the
    // loading/error state before awaiting the API call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats();
  }, [loadStats]);

  const handleRefresh = async (event: CustomEvent) => {
    await loadStats();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton onClick={() => navigate('/conferences')}>
              <IonIcon slot="icon-only" icon={close} />
            </IonButton>
          </IonButtons>
          <IonTitle>Statistics</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={helpModal.open}>
              <IonIcon slot="icon-only" icon={helpCircleOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingIcon={refreshCircle}
            refreshingSpinner="crescent"
          />
        </IonRefresher>

        {loading && <LoadingSpinner message="Loading statistics..." />}

        <ErrorMessage error={error} variant="card" />

        {!loading && !error && stats && stats.length === 0 && (
          <div className="ion-text-center" style={{ marginTop: '50px' }}>
            <IonText color="medium">
              <p>No statistics available</p>
            </IonText>
          </div>
        )}

        {!loading && !error && stats && stats.length > 0 && (
          <div>
            {stats.map((group, groupIndex) => {
              const [headers, rows] = group;

              return (
                <IonCard key={groupIndex}>
                  <IonCardHeader>
                    <IonCardTitle>
                      {headers && headers.length > 0 && headers[0] ? headers[0] : `Statistics ${groupIndex + 1}`}
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {headers.map((header, idx) => (
                              <th
                                key={idx}
                                style={{
                                  textAlign: 'left',
                                  padding: '8px',
                                  borderBottom: '2px solid #ddd',
                                  fontWeight: 'bold',
                                }}
                              >
                                {header || ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  style={{
                                    padding: '8px',
                                    borderBottom: '1px solid #eee',
                                  }}
                                >
                                  {cell || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>

      <HelpModal
        isOpen={helpModal.isOpen}
        onClose={helpModal.close}
        helpSection={helpContent.stats}
      />
    </IonPage>
  );
};

export default StatsPage;
