/**
 * Conference List Page
 * Displays all stored conferences and allows selecting/managing them
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  IonIcon,
  IonText,
  IonSpinner,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonBadge,
  IonSearchbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonModal,
  IonTextarea,
} from '@ionic/react';
import { add, trash, radio, radioOutline, qrCodeOutline, helpCircleOutline, statsChartOutline, chevronDown, close, closeCircle, stopCircle } from 'ionicons/icons';
import { useConferenceStore } from '../store/conferenceStore';
import { createApiClientFromConference } from '../utils/apiUrlBuilder';
import { CheckinRegistration, SponsorRegistration, ApiError } from '../types/api';
import { Conference } from '../types/conference';
import HelpModal from '../components/HelpModal';
import { helpContent } from '../content/helpContent';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { isCheckinRegistration } from '../utils/typeGuards';
import { HighlightedText } from '../components/HighlightedText';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useModal } from '../hooks/useModal';
import { TIMEOUTS } from '../constants/app';

const ConferenceListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const helpModal = useModal();
  const conferenceModal = useModal();
  const [hideMainContent, setHideMainContent] = useState(false);

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<CheckinRegistration | SponsorRegistration | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [sponsorNotes, setSponsorNotes] = useState<string>('');

  const {
    conferences,
    activeConferenceId,
    isLoading,
    error,
    setActiveConference,
    deleteConference,
    clearError,
  } = useConferenceStore();

  // Check if we should open the modal based on navigation state
  useEffect(() => {
    const state = location.state as { openModal?: boolean };
    console.log('[ConferenceList] Navigation state:', state);

    if (state?.openModal) {
      console.log('[ConferenceList] Opening modal from navigation state');
      // Hide main content immediately to prevent flash
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHideMainContent(true);
      // Use setTimeout to allow navigation transition to complete before opening modal
      setTimeout(() => {
        conferenceModal.open();
      }, TIMEOUTS.MODAL_TRANSITION);
      // Clear the state to prevent re-opening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, conferenceModal]);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CheckinRegistration[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAddConference = () => {
    navigate('/conferences/add');
  };

  const handleStats = () => {
    navigate('/stats');
  };

  const handleScan = async () => {
    // If there's no active conference and only one conference, activate it first
    if (!activeConferenceId && conferences.length === 1) {
      await setActiveConference(conferences[0].id);
    }

    // Verify we have an active conference before scanning
    const currentState = useConferenceStore.getState();
    if (!currentState.activeConferenceId) {
      console.error('Failed to set active conference - no activeConferenceId');
      return;
    }

    // Hide main content before starting scan
    setHideMainContent(true);

    // Start scanning directly
    startScan();
  };

  const startScan = async () => {
    const activeConf = conferences.find(c => c.id === activeConferenceId);
    if (!activeConf) {
      setScanError('No active conference selected');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      // Check support
      const supported = await BarcodeScanner.isSupported();
      if (!supported.supported) {
        setScanError('Barcode scanning is not supported on this device');
        setIsScanning(false);
        return;
      }

      // Check permissions
      const permStatus = await BarcodeScanner.checkPermissions();
      if (permStatus.camera !== 'granted') {
        const permResult = await BarcodeScanner.requestPermissions();
        if (permResult.camera !== 'granted') {
          setScanError('Camera permission denied. Please enable camera access in settings.');
          setIsScanning(false);
          return;
        }
      }

      // Hide WebView and start scanning
      document.body.classList.add('barcode-scanner-active');

      // Add barcode listener
      const listener = await BarcodeScanner.addListener('barcodesScanned', async (result) => {
        console.log('[Scanner] Barcode scanned:', result);

        // Stop scanning and remove listener
        await BarcodeScanner.stopScan();
        await listener.remove();
        document.body.classList.remove('barcode-scanner-active');

        if (!result.barcodes || result.barcodes.length === 0) {
          setScanError('No barcode found');
          setScanResult(null);
          setIsScanning(false);
          return;
        }

        const qrCode = result.barcodes[0].rawValue;
        console.log('[Scanner] Scanned QR code:', qrCode);

        // Create API client for the active conference
        const apiClient = createApiClientFromConference(activeConf);

        try {
          const lookupResponse = await apiClient.lookupAttendee(qrCode);
          const attendee = 'reg' in lookupResponse ? lookupResponse.reg : null;

          if (!attendee) {
            setScanError('Invalid response from server');
            setScanResult(null);
            setIsScanning(false);
            return;
          }

          console.log('[Scanner] Attendee found:', attendee.name);
          setScanResult(attendee);

          // For sponsor scans, pre-populate notes if they exist
          if (activeConf.mode === 'sponsor' && !isCheckinRegistration(attendee)) {
            setSponsorNotes(attendee.note || '');
          }

          // Check-in registrations have the 'already' field
          if (isCheckinRegistration(attendee)) {
            setAlreadyCheckedIn(!!attendee.already);
          }

          setScanError(null);
          setIsScanning(false);
        } catch (apiError: unknown) {
          console.error('[Scanner] API error:', apiError);
          setScanError(apiError instanceof Error ? apiError.message : 'Failed to lookup attendee');
          setScanResult(null);
          setIsScanning(false);
        }
      });

      // Start scanning
      await BarcodeScanner.startScan();
    } catch (error) {
      document.body.classList.remove('barcode-scanner-active');
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Scanner] Scan error:', msg);
      setScanError(`Scan failed: ${msg}`);
      setScanResult(null);
      setIsScanning(false);
    }
  };

  const checkIn = async () => {
    if (!scanResult) return;

    const activeConf = conferences.find(c => c.id === activeConferenceId);
    if (!activeConf) return;

    setCheckingIn(true);
    setScanError(null);

    try {
      const apiClient = createApiClientFromConference(activeConf);

      // Include notes for sponsor scans
      const storeData = activeConf.mode === 'sponsor'
        ? { token: scanResult.token, note: sponsorNotes }
        : { token: scanResult.token };

      await apiClient.store(storeData);

      // Check-in successful - return to home screen after brief delay
      setCheckingIn(false);
      setTimeout(() => {
        setScanResult(null);
        setScanError(null);
        setAlreadyCheckedIn(false);
        setSponsorNotes('');
        setHideMainContent(false);
      }, TIMEOUTS.CHECKIN_SUCCESS_DELAY);
    } catch (apiError: unknown) {
      console.error('[Scanner] Check-in error:', apiError);
      setScanError(apiError instanceof Error ? apiError.message : 'Failed to check in');
      setCheckingIn(false);
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setScanError(null);
    setAlreadyCheckedIn(false);
    setSponsorNotes('');
  };

  const cancelScan = async () => {
    console.log('[Scanner] Cancelling scan');
    try {
      await BarcodeScanner.stopScan();
      document.body.classList.remove('barcode-scanner-active');
      setIsScanning(false);
      setScanError(null);
      setHideMainContent(false);
    } catch (error) {
      console.error('[Scanner] Error cancelling scan:', error);
    }
  };

  // Search functionality
  const performSearch = async (query: string) => {
    if (!activeConferenceId || !query || query.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const activeConference = conferences.find(c => c.id === activeConferenceId);
    if (!activeConference) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const trimmedQuery = query.trim();

    try {
      console.log('[ConferenceList] Performing search:', {
        query: trimmedQuery,
        mode: activeConference.mode,
        eventSlug: activeConference.eventSlug,
      });

      const apiClient = createApiClientFromConference(activeConference);
      const searchResponse = await apiClient.searchAttendees(trimmedQuery);

      console.log('[ConferenceList] Search response:', {
        query: trimmedQuery,
        resultCount: searchResponse.regs?.length || 0,
        results: searchResponse.regs?.map(r => ({ id: r.id, name: r.name })) || [],
      });

      // Set results (with longer debounce, race conditions are less likely)
      setSearchResults(searchResponse.regs || []);
    } catch (apiError: unknown) {
      const error = apiError as ApiError;
      console.error('[ConferenceList] Search error:', {
        query: trimmedQuery,
        error: apiError,
        errorType: error?.type,
        errorMessage: error?.message,
        statusCode: error?.statusCode,
      });

      // Clear results on error
      setSearchResults([]);
    } finally {
      // Always stop the searching spinner, even if query has changed
      setSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length > 0) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, TIMEOUTS.SEARCH_DEBOUNCE);
    } else {
      setSearchResults([]);
      setSearching(false);
    }
  };

  const handleAttendeeSelect = async (attendee: CheckinRegistration) => {
    console.log('[ConferenceList] Attendee selected from search:', attendee.name);
    setSearchQuery('');
    setSearchResults([]);

    // Show attendee in scan result modal
    setScanResult(attendee);
    setAlreadyCheckedIn(!!attendee.already);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getDisplayName = (conference: Conference): string => {
    // Use displayName from API if available, otherwise fall back to name
    return conference.displayName || conference.name;
  };

  const getModeLabel = (mode: string, fieldId?: string | number | null): string => {
    switch (mode) {
      case 'checkin':
        return 'Check-In';
      case 'sponsor':
        return 'Sponsor Scanning';
      case 'field':
        return fieldId ? `Field Check-In: ${fieldId}` : 'Field Check-In';
      default:
        return mode;
    }
  };

  const activeConference = conferences.find(c => c.id === activeConferenceId);

  const handleConferenceSelect = async (id: string) => {
    await setActiveConference(id);
    conferenceModal.close();
    setHideMainContent(false);
  };

  const handleConferenceDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this conference?')) {
      await deleteConference(id);
    }
  };

  return (
    <IonPage>
      <IonHeader style={{ visibility: hideMainContent ? 'hidden' : 'visible' }}>
        <IonToolbar color="primary">
          <IonTitle>PGConf Scanner</IonTitle>
          <IonButtons slot="end">
            {activeConference?.mode === 'checkin' && (
              <IonButton onClick={handleStats}>
                <IonIcon slot="icon-only" icon={statsChartOutline} />
              </IonButton>
            )}
            <IonButton onClick={helpModal.open}>
              <IonIcon slot="icon-only" icon={helpCircleOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <ErrorMessage error={error} onDismiss={clearError} />

        {isLoading ? (
          <LoadingSpinner message="Loading conference scans..." />
        ) : conferences.length === 0 ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '50%' }}>
            <IonText color="medium">
              <h2>No Conference Scans</h2>
              <p>Add a conference scan to get started</p>
            </IonText>
            <IonButton onClick={handleAddConference}>
              <IonIcon slot="start" icon={add} />
              Add Conference Scan
            </IonButton>
          </div>
        ) : (
          <>
            {/* Conference Info Sub-header */}
            {activeConference && (
              <div style={{
                visibility: hideMainContent ? 'hidden' : 'visible',
                textAlign: 'center',
                padding: '24px 16px 0 16px',
                borderBottom: '1px solid var(--ion-border-color, #ddd)',
                backgroundColor: 'var(--ion-background-color, #fff)'
              }}>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--ion-color-dark)',
                  marginBottom: '4px'
                }}>
                  {activeConference.displayName || activeConference.name}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--ion-color-step-600)',
                  marginBottom: '16px'
                }}>
                  {getModeLabel(activeConference.mode, activeConference.fieldId)}
                </div>
              </div>
            )}

            {/* Vertically centered scanning controls */}
            <div style={{
              visibility: hideMainContent ? 'hidden' : 'visible',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 'calc(100vh - 56px - 60px - 100px)', // viewport - header - footer - subheader
              padding: '16px'
            }}>
              <IonButton
                expand="block"
                size="large"
                onClick={handleScan}
                color="success"
                disabled={!activeConferenceId && conferences.length !== 1}
              >
                <IonIcon slot="start" icon={qrCodeOutline} />
                {activeConferenceId
                  ? 'Start Scanning'
                  : conferences.length === 1
                  ? 'Select & Scan'
                  : 'Select a Conference Scan'}
              </IonButton>

              {/* Search Bar - Only available for check-in mode */}
              {activeConferenceId && activeConference?.mode === 'checkin' && (
                <div style={{ marginTop: '16px' }}>
                  <IonSearchbar
                    value={searchQuery}
                    onIonInput={(e) => handleSearchChange(e.detail.value || '')}
                    placeholder="Search attendees by name..."
                    debounce={0}
                    showClearButton="focus"
                  />

                  {/* Search Results Dropdown */}
                  {searchQuery.trim().length > 0 && (
                    <IonCard style={{ marginTop: '8px', marginBottom: '0' }}>
                      <IonCardContent style={{ padding: '0' }}>
                        {searching ? (
                          <div style={{ padding: '16px', textAlign: 'center' }}>
                            <IonSpinner />
                            <p style={{ marginTop: '8px', color: '#666' }}>Searching...</p>
                          </div>
                        ) : searchResults.length > 0 ? (
                          <IonList style={{ padding: '0' }}>
                            {searchResults.map((attendee) => (
                              <IonItem
                                key={attendee.id}
                                button
                                onClick={() => handleAttendeeSelect(attendee)}
                                detail={false}
                              >
                                <IonLabel>
                                  <h2><HighlightedText text={attendee.name} query={searchQuery} /></h2>
                                  {attendee.company && (
                                    <p>
                                      <IonText color="medium">
                                        <HighlightedText text={attendee.company} query={searchQuery} />
                                      </IonText>
                                    </p>
                                  )}
                                </IonLabel>
                              </IonItem>
                            ))}
                          </IonList>
                        ) : (
                          <div style={{ padding: '16px' }}>
                            <IonText color="medium">
                              <p style={{ margin: 0, textAlign: 'center' }}>No results found</p>
                            </IonText>
                          </div>
                        )}
                      </IonCardContent>
                    </IonCard>
                  )}
                </div>
              )}
            </div>

            {/* Conference Selector at Bottom */}
            <div style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'var(--ion-background-color, #fff)',
              borderTop: '1px solid var(--ion-border-color, #ddd)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              zIndex: 10
            }}>
              <IonButton
                expand="full"
                fill="clear"
                onClick={conferenceModal.open}
                style={{ margin: 0, height: '60px' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0 16px'
                }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    {activeConference ? (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>
                          {getDisplayName(activeConference)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                          {getModeLabel(activeConference.mode, activeConference.fieldId)}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '16px', color: 'var(--ion-color-medium)' }}>
                        Select Conference Scan
                      </div>
                    )}
                  </div>
                  <IonIcon icon={chevronDown} />
                </div>
              </IonButton>
            </div>
          </>
        )}
      </IonContent>

      {/* Conference Selection Modal */}
      <IonModal isOpen={conferenceModal.isOpen} onDidDismiss={() => {
        conferenceModal.close();
        setHideMainContent(false);
      }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Select Conference Scan</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={conferenceModal.close}>
                <IonIcon slot="icon-only" icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            {conferences.map(conference => (
              <IonItemSliding key={conference.id}>
                <IonItem
                  button
                  onClick={() => handleConferenceSelect(conference.id)}
                  detail={false}
                >
                  <IonIcon
                    slot="start"
                    icon={conference.id === activeConferenceId ? radio : radioOutline}
                    color={conference.id === activeConferenceId ? 'primary' : 'medium'}
                  />
                  <IonLabel>
                    <h2>{getDisplayName(conference)}</h2>
                    <p>
                      <IonText color="medium">
                        <small>Added: {formatDate(conference.addedAt)}</small>
                      </IonText>
                    </p>
                  </IonLabel>
                  <IonBadge slot="end" color="primary">
                    {getModeLabel(conference.mode, conference.fieldId)}
                  </IonBadge>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption
                    color="danger"
                    onClick={() => handleConferenceDelete(conference.id)}
                  >
                    <IonIcon slot="icon-only" icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}

            {/* Add Conference Option */}
            <IonItem button onClick={handleAddConference} detail={false}>
              <IonIcon slot="start" icon={add} color="primary" />
              <IonLabel color="primary">
                <h2>Add Conference Scan</h2>
              </IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonModal>

      {/* Scan Result Modal */}
      <IonModal
        isOpen={isScanning || scanResult !== null || scanError !== null}
        onDidDismiss={() => {
          setIsScanning(false);
          setScanResult(null);
          setScanError(null);
          setAlreadyCheckedIn(false);
          setHideMainContent(false);
        }}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>
              {isScanning ? 'Scanning...' : scanResult ? 'Scan Result' : 'Scan Error'}
            </IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => {
                setIsScanning(false);
                setScanResult(null);
                setScanError(null);
                setAlreadyCheckedIn(false);
                setHideMainContent(false);
              }}>
                <IonIcon slot="icon-only" icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {isScanning && (
            <div className="ion-text-center" style={{ marginTop: '50%' }}>
              <IonSpinner style={{ width: '56px', height: '56px' }} />
              <p style={{ marginTop: '16px' }}>Point camera at QR code...</p>
            </div>
          )}

          {scanError && !isScanning && (
            <div className="ion-text-center" style={{ marginTop: '20%' }}>
              <IonIcon
                icon={closeCircle}
                style={{ fontSize: '64px', color: 'var(--ion-color-danger)' }}
              />
              <h2>Error</h2>
              <IonText color="danger">
                <p>{scanError}</p>
              </IonText>
              <IonButton
                expand="block"
                onClick={() => {
                  setScanError(null);
                  startScan();
                }}
                style={{ marginTop: '24px' }}
              >
                Try Again
              </IonButton>
            </div>
          )}

          {scanResult && !isScanning && (
            <div style={{ marginTop: '20px' }}>
              {/* Sponsor Scan UI */}
              {activeConference?.mode === 'sponsor' && !isCheckinRegistration(scanResult) ? (
                <>
                  {/* Sponsor Attendee Details Card */}
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>{scanResult.name}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonList>
                        {scanResult.email && (
                          <IonItem>
                            <IonLabel>
                              <strong>Email:</strong> {scanResult.email}
                            </IonLabel>
                          </IonItem>
                        )}
                        {scanResult.company && (
                          <IonItem>
                            <IonLabel>
                              <strong>Company:</strong> {scanResult.company}
                            </IonLabel>
                          </IonItem>
                        )}
                        {scanResult.country && (
                          <IonItem>
                            <IonLabel>
                              <strong>Country:</strong> {scanResult.country}
                            </IonLabel>
                          </IonItem>
                        )}
                      </IonList>

                      {/* Highlight Badges */}
                      {scanResult.highlight && scanResult.highlight.length > 0 && (
                        <div style={{ marginTop: '15px' }}>
                          {scanResult.highlight.map((hl, idx) => (
                            <IonBadge key={idx} color="primary" style={{ marginRight: '5px', marginBottom: '5px' }}>
                              {hl}
                            </IonBadge>
                          ))}
                        </div>
                      )}

                      {/* Notes Input */}
                      <div style={{ marginTop: '20px' }}>
                        <IonItem>
                          <IonLabel position="stacked">Notes</IonLabel>
                          <IonTextarea
                            value={sponsorNotes}
                            onIonInput={(e) => setSponsorNotes(e.detail.value || '')}
                            placeholder="Enter notes about this lead..."
                            rows={4}
                            disabled={checkingIn}
                          />
                        </IonItem>
                      </div>
                    </IonCardContent>
                  </IonCard>

                  {/* Save Lead Button */}
                  <IonButton
                    expand="block"
                    size="large"
                    color="success"
                    onClick={checkIn}
                    disabled={checkingIn}
                    style={{ marginTop: '20px' }}
                  >
                    {checkingIn ? 'Saving Lead...' : 'Save Lead'}
                  </IonButton>

                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => {
                      resetScan();
                    }}
                    style={{ marginTop: '16px' }}
                  >
                    Cancel
                  </IonButton>
                </>
              ) : isCheckinRegistration(scanResult) ? (
                /* Check-in Scan UI */
                <>
                  {/* Already Checked In Warning */}
                  {alreadyCheckedIn && scanResult.already && (
                    <IonCard color="warning">
                      <IonCardHeader>
                        <IonCardTitle>{scanResult.already.title}</IonCardTitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <IonText>
                          <p>{scanResult.already.body}</p>
                        </IonText>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Attendee Details Card */}
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>{scanResult.name}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonList>
                        {scanResult.company && (
                          <IonItem>
                            <IonLabel>
                              <strong>Company:</strong> {scanResult.company}
                            </IonLabel>
                          </IonItem>
                        )}
                        <IonItem>
                          <IonLabel>
                            <strong>Type:</strong> {scanResult.type}
                          </IonLabel>
                        </IonItem>
                        {scanResult.tshirt && (
                          <IonItem>
                            <IonLabel>
                              <strong>T-Shirt:</strong> {scanResult.tshirt}
                            </IonLabel>
                          </IonItem>
                        )}
                        {scanResult.partition && activeConference?.mode !== 'field' && (
                          <IonItem>
                            <IonLabel>
                              <strong>Partition:</strong> {scanResult.partition}
                            </IonLabel>
                          </IonItem>
                        )}
                        {scanResult.photoconsent && (
                          <IonItem>
                            <IonLabel>
                              <strong>Photo Consent:</strong> {scanResult.photoconsent}
                            </IonLabel>
                          </IonItem>
                        )}
                        {scanResult.policyconfirmed && activeConference?.mode !== 'field' && (
                          <IonItem>
                            <IonLabel>
                              <strong>Policy:</strong>{' '}
                              {scanResult.policyconfirmed.toLowerCase().includes('no') ? (
                                <>
                                  <IonIcon
                                    icon={stopCircle}
                                    color="danger"
                                    style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '4px' }}
                                  />
                                  NOT CONFIRMED
                                </>
                              ) : (
                                'Confirmed'
                              )}
                            </IonLabel>
                          </IonItem>
                        )}
                      </IonList>

                      {/* Highlight Badges */}
                      {scanResult.highlight && scanResult.highlight.length > 0 && (
                        <div style={{ marginTop: '15px' }}>
                          {scanResult.highlight
                            .filter(hl => !hl.toLowerCase().includes('policyconfirmed'))
                            .map((hl, idx) => (
                              <IonBadge key={idx} color="primary" style={{ marginRight: '5px', marginBottom: '5px' }}>
                                {hl}
                              </IonBadge>
                            ))}
                        </div>
                      )}

                      {/* Additional Information */}
                      {scanResult.additional && scanResult.additional.length > 0 && (
                        <div style={{ marginTop: '15px' }}>
                          <IonText color="medium">
                            <p><strong>Additional Info:</strong></p>
                          </IonText>
                          {scanResult.additional.map((info, idx) => (
                            <IonText key={idx}>
                              <p style={{ marginTop: '5px', fontSize: '14px' }}>{info}</p>
                            </IonText>
                          ))}
                        </div>
                      )}

                      {/* Check-in Message */}
                      {scanResult.checkinmessage && (
                        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
                          <IonText>
                            <p style={{ margin: 0 }}>{scanResult.checkinmessage}</p>
                          </IonText>
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>

                  {/* Check-In Button */}
                  {!alreadyCheckedIn && (() => {
                    const policyNotConfirmed = activeConference?.mode !== 'field' && Boolean(scanResult.policyconfirmed && scanResult.policyconfirmed.toLowerCase().includes('no'));
                    const isDisabled = checkingIn || policyNotConfirmed;

                    return (
                      <IonButton
                        expand="block"
                        size="large"
                        color={policyNotConfirmed ? "danger" : "success"}
                        onClick={checkIn}
                        disabled={isDisabled}
                        style={{
                          marginTop: '20px',
                          ...(policyNotConfirmed && {
                            '--background': 'rgba(var(--ion-color-danger-rgb), 0.4)',
                            '--background-hover': 'rgba(var(--ion-color-danger-rgb), 0.4)',
                            '--background-activated': 'rgba(var(--ion-color-danger-rgb), 0.4)',
                            '--background-focused': 'rgba(var(--ion-color-danger-rgb), 0.4)',
                          })
                        }}
                      >
                        {checkingIn
                          ? (activeConference?.mode === 'field'
                              ? `Confirming ${activeConference.fieldId}...`
                              : 'Checking In...')
                          : (activeConference?.mode === 'field'
                              ? `Confirm ${String(activeConference.fieldId).charAt(0).toUpperCase() + String(activeConference.fieldId).slice(1)}`
                              : 'Check In')
                        }
                      </IonButton>
                    );
                  })()}

                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => {
                      resetScan();
                    }}
                    style={{ marginTop: '16px' }}
                  >
                    Cancel
                  </IonButton>
                </>
              ) : null}
            </div>
          )}
        </IonContent>
      </IonModal>

      <HelpModal
        isOpen={helpModal.isOpen}
        onClose={helpModal.close}
        helpSection={helpContent.conferenceList}
      />

      {/* Scanner Overlay - shown when barcode-scanner-active class is added to body */}
      <div className="scanner-overlay">
        <div className="scanner-overlay-background"></div>
        <button className="scanner-cancel-button" onClick={cancelScan}>
          Cancel
        </button>
        <div className="scanner-focus-box">
          <div className="scanner-focus-corner top-left"></div>
          <div className="scanner-focus-corner top-right"></div>
          <div className="scanner-focus-corner bottom-left"></div>
          <div className="scanner-focus-corner bottom-right"></div>
          <div className="scanner-scan-line"></div>
          <div className="scanner-instruction">Point camera at QR code</div>
        </div>
      </div>
    </IonPage>
  );
};

export default ConferenceListPage;
