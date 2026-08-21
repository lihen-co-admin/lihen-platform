// Generated from Supabase DEV project vnmkupzptujtywnnabkp after FASE 1.17 Storage foundation.
// Infrastructure-only type. Domain packages must not depend on this file directly.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admin_roles: {
        Row: { code: string; created_at: string; description: string | null; name: string; sort_order: number };
        Insert: { code: string; created_at?: string; description?: string | null; name: string; sort_order?: number };
        Update: Partial<Database['public']['Tables']['admin_roles']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: { approved_at: string | null; approved_by: string | null; authorization_status: string; created_at: string; display_name: string | null; email: string | null; id: string; role_code: string; updated_at: string };
        Insert: { approved_at?: string | null; approved_by?: string | null; authorization_status?: string; created_at?: string; display_name?: string | null; email?: string | null; id: string; role_code?: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [{ foreignKeyName: 'profiles_role_code_fkey'; columns: ['role_code']; isOneToOne: false; referencedRelation: 'admin_roles'; referencedColumns: ['code'] }];
      };
      business_lines: {
        Row: { code: string; display_name: string; status: string; sort_order: number; created_at: string; updated_at: string };
        Insert: { code: string; display_name: string; status?: string; sort_order?: number; created_at?: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['business_lines']['Insert']>;
        Relationships: [];
      };
      brands: {
        Row: {
          id: string; name: string; normalized_name: string; logo_url: string | null;
          description: string | null; status: string; created_at: string; updated_at: string;
        };
        Insert: { id?: string; name: string; normalized_name: string; logo_url?: string | null; description?: string | null; status?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['brands']['Insert']>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string; name: string; normalized_name: string; slug: string | null; business_line: string;
          parent_id: string | null; status: string; sort_order: number; created_at: string; updated_at: string;
        };
        Insert: { id?: string; name: string; normalized_name: string; slug?: string | null; business_line: string; parent_id?: string | null; status?: string; sort_order?: number; created_at?: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
        Relationships: [{ foreignKeyName: 'categories_parent_id_fkey'; columns: ['parent_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] }];
      };

      product_images: {
        Row: { alt_text: string | null; created_at: string; id: string; is_main: boolean; product_id: string; public_url: string; sort_order: number; source_type: string; status: string; storage_bucket: string | null; storage_path: string | null; updated_at: string };
        Insert: { alt_text?: string | null; created_at?: string; id: string; is_main?: boolean; product_id: string; public_url: string; sort_order?: number; source_type?: string; status?: string; storage_bucket?: string | null; storage_path?: string | null; updated_at?: string };
        Update: Partial<Database['public']['Tables']['product_images']['Insert']>;
        Relationships: [{ foreignKeyName: 'product_images_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }];
      };
      product_sale_price_history: {
        Row: { actor_id: string; changed_at: string; currency: string; id: string; new_price: number; previous_price: number; product_id: string; reason: string };
        Insert: { actor_id: string; changed_at?: string; currency?: string; id: string; new_price: number; previous_price: number; product_id: string; reason: string };
        Update: { actor_id?: string; changed_at?: string; currency?: string; id?: string; new_price?: number; previous_price?: number; product_id?: string; reason?: string };
        Relationships: [{ foreignKeyName: 'product_sale_price_history_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }];
      };
      products: {
        Row: {
          id: string; sku: string | null; catalog_code: string | null; name: string; business_line: string;
          brand: string | null; category: string | null; subcategory: string | null; description: string | null;
          sale_price: number; current_cost: number | null; minimum_stock: number; status: string;
          visible_on_website: boolean; main_image_url: string | null; brand_id: string | null; category_id: string | null;
          created_at: string; updated_at: string;
        };
        Insert: { id?: string; sku?: string | null; catalog_code?: string | null; name: string; business_line: string; brand?: string | null; category?: string | null; subcategory?: string | null; description?: string | null; sale_price: number; current_cost?: number | null; minimum_stock?: number; status?: string; visible_on_website?: boolean; main_image_url?: string | null; brand_id?: string | null; category_id?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
        Relationships: [
          { foreignKeyName: 'products_brand_id_fkey'; columns: ['brand_id']; isOneToOne: false; referencedRelation: 'brands'; referencedColumns: ['id'] },
          { foreignKeyName: 'products_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      add_product_image_controlled: {
        Args: {
          p_operation_key: string;
          p_image_id: string;
          p_product_id: string;
          p_public_url: string;
          p_alt_text: string | null;
          p_make_main: boolean;
        };
        Returns: Array<{
          alt_text: string | null;
          created_at: string;
          id: string;
          is_main: boolean;
          product_id: string;
          public_url: string;
          sort_order: number;
          source_type: string;
          status: string;
          storage_bucket: string | null;
          storage_path: string | null;
          updated_at: string;
        }>;
      };

      change_product_sale_price_controlled: {
        Args: {
          p_operation_key: string;
          p_history_id: string;
          p_product_id: string;
          p_new_price: number;
          p_currency: string;
          p_reason: string;
        };
        Returns: Array<{
          id: string;
          sku: string;
          catalog_code: string;
          name: string;
          business_line: string;
          brand_id: string;
          category_id: string;
          status: string;
          sale_price: number;
          history_id: string;
          previous_price: number;
          currency: string;
          reason: string;
          actor_id: string;
          changed_at: string;
        }>;
      };
      create_product_controlled: {
        Args: {
          p_operation_key: string;
          p_id: string;
          p_sku: string;
          p_catalog_code: string;
          p_name: string;
          p_business_line: string;
          p_brand_id: string;
          p_category_id: string;
          p_status: string;
          p_sale_price: number;
        };
        Returns: Array<{
          id: string;
          sku: string;
          catalog_code: string;
          name: string;
          business_line: string;
          brand_id: string;
          category_id: string;
          status: string;
          sale_price: number;
        }>;
      };
      get_product_images: {
        Args: { p_product_id: string };
        Returns: Array<{
          alt_text: string | null; created_at: string; id: string; is_main: boolean; product_id: string; public_url: string; sort_order: number; source_type: string; status: string; storage_bucket: string | null; storage_path: string | null; updated_at: string;
        }>;
      };
      get_product_sale_price_history: {
        Args: { p_product_id: string };
        Returns: Array<{
          actor_id: string;
          changed_at: string;
          currency: string;
          id: string;
          new_price: number;
          previous_price: number;
          product_id: string;
          reason: string;
        }>;
      };
      set_main_product_image_controlled: {
        Args: {
          p_operation_key: string;
          p_product_id: string;
          p_image_id: string;
        };
        Returns: Array<{
          alt_text: string | null;
          created_at: string;
          id: string;
          is_main: boolean;
          product_id: string;
          public_url: string;
          sort_order: number;
          source_type: string;
          status: string;
          storage_bucket: string | null;
          storage_path: string | null;
          updated_at: string;
        }>;
      };
      update_product_controlled: {
        Args: {
          p_operation_key: string;
          p_product_id: string;
          p_sku: string;
          p_catalog_code: string;
          p_name: string;
          p_business_line: string;
          p_brand_id: string;
          p_category_id: string;
          p_status: string;
        };
        Returns: Array<{
          id: string;
          sku: string;
          catalog_code: string;
          name: string;
          business_line: string;
          brand_id: string;
          category_id: string;
          status: string;
          sale_price: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
