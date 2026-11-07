export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          full_name: string | null;
          role: "merchant" | "customer";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone?: string | null;
          full_name?: string | null;
          role?: "merchant" | "customer";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string | null;
          full_name?: string | null;
          role?: "merchant" | "customer";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shops: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          category: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          upi_id: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          category?: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          upi_id?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          category?: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          upi_id?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_customers: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          credit_limit: number;
          current_balance: number;
          status: "active" | "blocked" | "paused";
          joined_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          credit_limit?: number;
          current_balance?: number;
          status?: "active" | "blocked" | "paused";
          joined_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string;
          credit_limit?: number;
          current_balance?: number;
          status?: "active" | "blocked" | "paused";
          joined_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          amount: number;
          type: "credit" | "payment";
          note: string | null;
          running_balance: number;
          created_by: string;
          created_at: string;
          is_reversed: boolean;
          reversed_by: string | null;
          reversed_at: string | null;
          reverse_reason: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          amount: number;
          type: "credit" | "payment";
          note?: string | null;
          running_balance: number;
          created_by: string;
          created_at?: string;
          is_reversed?: boolean;
          reversed_by?: string | null;
          reversed_at?: string | null;
          reverse_reason?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string;
          amount?: number;
          type?: "credit" | "payment";
          note?: string | null;
          running_balance?: number;
          created_by?: string;
          created_at?: string;
          is_reversed?: boolean;
          reversed_by?: string | null;
          reversed_at?: string | null;
          reverse_reason?: string | null;
        };
      };
    };
    Functions: {
      add_transaction: {
        Args: {
          p_shop_id: string;
          p_customer_id: string;
          p_amount: number;
          p_type: "credit" | "payment";
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["transactions"]["Row"];
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type ShopCustomer = Database["public"]["Tables"]["shop_customers"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
