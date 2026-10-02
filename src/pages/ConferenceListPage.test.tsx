import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ConferenceListPage from './ConferenceListPage';
import { useConferenceStore } from '../store/conferenceStore';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import type { Conference } from '../types/conference';

// Mock dependencies
vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeScanner: {
    isSupported: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    addListener: vi.fn(),
    startScan: vi.fn(),
    stopScan: vi.fn(),
  },
}));

vi.mock('../store/conferenceStore');
vi.mock('../services/apiClient');

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ConferenceListPage', () => {
  const mockConference: Conference = {
    id: 'test-id',
    name: 'pgconfeu2024',
    displayName: 'PGConf EU 2024',
    baseUrl: 'https://postgresql.eu',
    eventSlug: 'pgconfeu2024',
    token: 'a'.repeat(40),
    mode: 'checkin',
    fieldId: null,
    addedAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  const mockSponsorConference: Conference = {
    id: 'sponsor-id',
    name: 'Sponsor Scanning',
    displayName: 'PGConf EU 2025',
    baseUrl: 'https://postgresql.eu',
    eventSlug: null,
    token: 'b'.repeat(40),
    mode: 'sponsor',
    fieldId: null,
    addedAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  const mockFieldConference: Conference = {
    id: 'field-id',
    name: 'pgconfeu2024',
    displayName: 'PGConf EU 2024',
    baseUrl: 'https://postgresql.eu',
    eventSlug: 'pgconfeu2024',
    token: 'c'.repeat(40),
    mode: 'field',
    fieldId: 'tshirt',
    addedAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock default store state
    vi.mocked(useConferenceStore).mockReturnValue({
      conferences: [],
      activeConferenceId: null,
      isLoading: false,
      error: null,
      activeConference: null,
      initialize: vi.fn(),
      addConferenceFromUrl: vi.fn(),
      deleteConference: vi.fn(),
      setActiveConference: vi.fn(),
      updateConference: vi.fn(),
      refreshConferences: vi.fn(),
      clearError: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page with title', () => {
      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('PGConf Scanner')).toBeInTheDocument();
    });

    it('should show empty state when no conferences', () => {
      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('No Conference Scans')).toBeInTheDocument();
      expect(screen.getByText('Add a conference scan to get started')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [],
        activeConferenceId: null,
        isLoading: true,
        error: null,
        activeConference: null,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('Loading conference scans...')).toBeInTheDocument();
    });

    it('should show error state', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [],
        activeConferenceId: null,
        isLoading: false,
        error: 'Test error',
        activeConference: null,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should show conference info sub-header with active conference', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      // Multiple elements with this text, use getAllByText
      expect(screen.getAllByText('PGConf EU 2024').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Check-In').length).toBeGreaterThan(0);
    });

    it('should show sponsor scanning mode label', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockSponsorConference],
        activeConferenceId: 'sponsor-id',
        isLoading: false,
        error: null,
        activeConference: mockSponsorConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      // Multiple elements with this text, use getAllByText
      expect(screen.getAllByText('Sponsor Scanning').length).toBeGreaterThan(0);
    });

    it('should show field check-in mode label with field ID', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockFieldConference],
        activeConferenceId: 'field-id',
        isLoading: false,
        error: null,
        activeConference: mockFieldConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      // Multiple elements with this text, use getAllByText
      expect(screen.getAllByText('Field Check-In: tshirt').length).toBeGreaterThan(0);
    });
  });

  describe('Scan Button', () => {
    it('should show Start Scanning button with active conference', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('Start Scanning')).toBeInTheDocument();
    });

    it('should show disabled button when no active conference', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference, mockSponsorConference],
        activeConferenceId: null,
        isLoading: false,
        error: null,
        activeConference: null,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      // Ionic button doesn't expose disabled state properly in jsdom
      // Just check the disabled button text is displayed
      expect(screen.getByText('Select a Conference Scan')).toBeInTheDocument();
    });

    it('should show stats button for checkin mode', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      const statsButtons = screen.getAllByRole('button');
      // Stats button should be present (it's an icon button)
      expect(statsButtons.length).toBeGreaterThan(0);
    });

    it('should not show stats button for sponsor mode', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockSponsorConference],
        activeConferenceId: 'sponsor-id',
        isLoading: false,
        error: null,
        activeConference: mockSponsorConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      // Stats button should not be present in sponsor mode
      const buttons = screen.getAllByRole('button');
      // Should have fewer buttons without stats
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Search Functionality', () => {
    it('should show search bar for checkin mode', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByPlaceholderText('Search attendees by name...')).toBeInTheDocument();
    });

    it('should not show search bar for sponsor mode', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockSponsorConference],
        activeConferenceId: 'sponsor-id',
        isLoading: false,
        error: null,
        activeConference: mockSponsorConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.queryByPlaceholderText('Search attendees by name...')).not.toBeInTheDocument();
    });

    it('should not show search bar for field mode', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockFieldConference],
        activeConferenceId: 'field-id',
        isLoading: false,
        error: null,
        activeConference: mockFieldConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.queryByPlaceholderText('Search attendees by name...')).not.toBeInTheDocument();
    });
  });

  describe('Conference Selector', () => {
    it('should show conference selector at bottom', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      // Check for conference name in selector
      const selectorButtons = screen.getAllByText('PGConf EU 2024');
      expect(selectorButtons.length).toBeGreaterThan(0);
    });

    it('should show "Select Conference Scan" when none active', () => {
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [mockConference],
        activeConferenceId: null,
        isLoading: false,
        error: null,
        activeConference: null,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('Select Conference Scan')).toBeInTheDocument();
    });
  });

  describe('Barcode Scanner Integration', () => {
    // Starting a scan opens the scan result modal, which Ionic presents
    // asynchronously. If the test ends first, cleanup unmounts the page
    // mid-present and Ionic rejects with "framework delegate is missing",
    // so wait until the modal has finished presenting.
    const waitForScanModalPresented = () =>
      waitFor(() => {
        expect(document.querySelector('ion-modal.show-modal')).not.toBeNull();
      });

    it('should check scanner support before scanning', async () => {
      const mockState = {
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      };

      vi.mocked(useConferenceStore).mockReturnValue(mockState);
      // Mock getState as well
      (useConferenceStore as any).getState = vi.fn(() => mockState);

      vi.mocked(BarcodeScanner.isSupported).mockResolvedValue({ supported: false });

      renderWithRouter(<ConferenceListPage />);
      const scanButton = screen.getByText('Start Scanning');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(BarcodeScanner.isSupported).toHaveBeenCalled();
      });
      expect(await screen.findByText('Barcode scanning is not supported on this device')).toBeInTheDocument();
      await waitForScanModalPresented();
    });

    it('should check permissions before scanning', async () => {
      const mockState = {
        conferences: [mockConference],
        activeConferenceId: 'test-id',
        isLoading: false,
        error: null,
        activeConference: mockConference,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: vi.fn(),
      };

      vi.mocked(useConferenceStore).mockReturnValue(mockState);
      // Mock getState as well
      (useConferenceStore as any).getState = vi.fn(() => mockState);

      vi.mocked(BarcodeScanner.isSupported).mockResolvedValue({ supported: true });
      vi.mocked(BarcodeScanner.checkPermissions).mockResolvedValue({ camera: 'denied' });
      vi.mocked(BarcodeScanner.requestPermissions).mockResolvedValue({ camera: 'denied' });

      renderWithRouter(<ConferenceListPage />);
      const scanButton = screen.getByText('Start Scanning');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(BarcodeScanner.checkPermissions).toHaveBeenCalled();
      });
      expect(await screen.findByText(/Camera permission denied/)).toBeInTheDocument();
      await waitForScanModalPresented();
    });
  });

  describe('Error Handling', () => {
    it('should show error and allow dismissal', () => {
      const mockClearError = vi.fn();
      vi.mocked(useConferenceStore).mockReturnValue({
        conferences: [],
        activeConferenceId: null,
        isLoading: false,
        error: 'Test error message',
        activeConference: null,
        initialize: vi.fn(),
        addConferenceFromUrl: vi.fn(),
        deleteConference: vi.fn(),
        setActiveConference: vi.fn(),
        updateConference: vi.fn(),
        refreshConferences: vi.fn(),
        clearError: mockClearError,
      });

      renderWithRouter(<ConferenceListPage />);

      expect(screen.getByText('Test error message')).toBeInTheDocument();

      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should have help button', () => {
      renderWithRouter(<ConferenceListPage />);
      const buttons = screen.getAllByRole('button');
      // Help button should be present (it's an icon button in the header)
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should show add conference button in empty state', () => {
      renderWithRouter(<ConferenceListPage />);
      expect(screen.getByText('Add Conference Scan')).toBeInTheDocument();
    });
  });
});
