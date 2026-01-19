declare module '@cloudflare/realtimekit-react' {
  import { ReactNode } from 'react';
  
  export interface RealtimeKitMeeting {
    join: () => Promise<void>;
    leave: () => void;
    self: {
      roomState: 'init' | 'joined' | 'left' | 'ended' | 'waitlisted';
    };
  }

  export interface InitMeetingOptions {
    authToken: string;
    defaults?: {
      audio?: boolean;
      video?: boolean;
    };
  }

  export function useRealtimeKitClient(): [RealtimeKitMeeting | undefined, (options: InitMeetingOptions) => void];
  
  export function useRealtimeKitSelector<T>(selector: (meeting: RealtimeKitMeeting) => T): T;

  export interface RealtimeKitProviderProps {
    value: RealtimeKitMeeting;
    children: ReactNode;
  }

  export function RealtimeKitProvider(props: RealtimeKitProviderProps): JSX.Element;
}

declare module '@cloudflare/realtimekit-react-ui' {
  import { ReactNode } from 'react';
  
  export interface RtkMeetingProps {
    meeting: any;
    mode?: 'fill' | 'fit';
  }

  export function RtkMeeting(props: RtkMeetingProps): JSX.Element;

  export interface RtkSetupScreenProps {
    meeting: any;
  }

  export function RtkSetupScreen(props: RtkSetupScreenProps): JSX.Element;

  export interface RtkUiProviderProps {
    meeting: any;
    children: ReactNode;
  }

  export function RtkUiProvider(props: RtkUiProviderProps): JSX.Element;
}
