export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
        Relationships: [];

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
        Relationships: [];

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
        Relationships: [
          {
            foreignKeyName: "shop_customers_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_customers_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];

      };
      transaction_reversals: {
        Row: {
          id: string;
          original_transaction_id: string;
          reversal_transaction_id: string;
          reversed_by: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          original_transaction_id: string;
          reversal_transaction_id: string;
          reversed_by: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          original_transaction_id?: string;
          reversal_transaction_id?: string;
          reversed_by?: string;
          reason?: string;
          created_at?: string;
        };
        Relationships: [];

      };
      transactions: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          idempotency_key: string | null;
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
          idempotency_key?: string | null;
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
          idempotency_key?: string | null;
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
        Relationships: [];

      };
    };
    Functions: {
      add_transaction: {
        Args: {
          p_shop_id: string;
          p_customer_id: string;
          p_amount: number;
          p_type: "credit" | "payment";
          p_idempotency_key: string;
          p_note?: string | null;
        };
        Returns: {
          id: string;
          shop_id: string;
          customer_id: string;
          idempotency_key: string | null;
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
      };
      reverse_transaction: {
        Args: {
          p_transaction_id: string;
          p_reason: string;
        };
        Returns: {
          id: string;
          shop_id: string;
          customer_id: string;
          idempotency_key: string | null;
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
      };
    };
    Views: {
      public_shops: {
        Row: {
          id: string;
          name: string;
          category: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          upi_id: string | null;
          description: string | null;
        };
        Relationships: [];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type PublicShop = Database["public"]["Views"]["public_shops"]["Row"];
export type ShopCustomer = Database["public"]["Tables"]["shop_customers"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
