export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          plan: 'free' | 'starter' | 'family';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_period: 'monthly' | 'annual' | null;
          subscription_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          plan?: 'free' | 'solo' | 'family' | 'team';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_period?: 'monthly' | 'annual' | null;
          subscription_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          plan?: 'free' | 'solo' | 'family' | 'team';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_period?: 'monthly' | 'annual' | null;
          subscription_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          content: string | null;
          is_private: boolean;
          pinned: boolean;
          trashed_at: string | null;
          trashed_by: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content?: string | null;
          is_private?: boolean;
          pinned?: boolean;
          trashed_at?: string | null;
          trashed_by?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string | null;
          is_private?: boolean;
          pinned?: boolean;
          trashed_at?: string | null;
          trashed_by?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
        };
      };
      note_tags: {
        Row: {
          note_id: string;
          tag_id: string;
        };
        Insert: {
          note_id: string;
          tag_id: string;
        };
        Update: {
          note_id?: string;
          tag_id?: string;
        };
      };
      note_shares: {
        Row: {
          id: string;
          note_id: string;
          shared_by: string;
          shared_with_email: string | null;
          shared_with_user: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          shared_by: string;
          shared_with_email?: string | null;
          shared_with_user?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          shared_by?: string;
          shared_with_email?: string | null;
          shared_with_user?: string | null;
          created_at?: string;
        };
      };
      default_shares: {
        Row: {
          id: string;
          user_id: string;
          shared_with_email: string;
          shared_with_user: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          shared_with_email: string;
          shared_with_user?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          shared_with_email?: string;
          shared_with_user?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
