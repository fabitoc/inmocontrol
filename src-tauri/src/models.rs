use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Unified application error type for database, filesystem, and domain rules.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Filesystem error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Domain validation error: {0}")]
    Domain(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Property owner entity with Colombian tax identification (CC/NIT) and disbursement account.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Owner {
    pub id: i64,
    pub name: String,
    pub document_id: String,
    pub phone: String,
    pub email: String,
    pub bank_name: String,
    pub bank_account_type: String,
    pub bank_account_number: String,
    pub created_at: String,
}

/// Payload for registering a new owner.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NewOwnerInput {
    pub name: String,
    pub document_id: String,
    pub phone: String,
    pub email: String,
    pub bank_name: String,
    pub bank_account_type: String,
    pub bank_account_number: String,
}

/// Real estate asset supporting self-referencing Matrix/Building -> Sub-unit hierarchy (`parent_property_id`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Property {
    pub id: i64,
    pub owner_id: i64,
    pub parent_property_id: Option<i64>,
    pub code: String,
    pub title: String,
    pub address: String,
    pub property_type: String,
    pub base_rent_cop: i64,
    pub commission_pct: f64,
    pub fixed_fee_cop: i64,
    pub cutoff_day: i64,
    /// Status values: `"DISPONIBLE"` | `"OCUPADO"`
    pub status: String,
    pub created_at: String,
}

/// Payload for registering a new property or sub-unit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NewPropertyInput {
    pub owner_id: i64,
    pub parent_property_id: Option<i64>,
    pub code: String,
    pub title: String,
    pub address: String,
    pub property_type: String,
    pub base_rent_cop: i64,
    pub commission_pct: f64,
    pub fixed_fee_cop: i64,
    pub cutoff_day: i64,
    pub status: String,
}

/// Active, finished, or delinquent lease agreement bound to a specific property.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TenantContract {
    pub id: i64,
    pub property_id: i64,
    pub tenant_name: String,
    pub tenant_document: String,
    pub guarantor_name: String,
    pub phone: String,
    pub monthly_rent_cop: i64,
    pub start_date: String,
    pub end_date: String,
    pub cutoff_day: i64,
    /// Status values: `"ACTIVO"` | `"FINALIZADO"` | `"MORA"`
    pub status: String,
    pub created_at: String,
}

/// Payload for creating a new lease contract.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NewContractInput {
    pub property_id: i64,
    pub tenant_name: String,
    pub tenant_document: String,
    pub guarantor_name: String,
    pub phone: String,
    pub monthly_rent_cop: i64,
    pub start_date: String,
    pub end_date: String,
    pub cutoff_day: i64,
    pub status: String,
}

/// Monthly rent collection record.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RentPayment {
    pub id: i64,
    pub contract_id: i64,
    pub property_id: i64,
    /// Billing period in `"YYYY-MM"` format, e.g. `"2026-10"`.
    pub period_month: String,
    pub gross_amount_cop: i64,
    pub payment_date: String,
    pub payment_method: String,
    pub reference_code: String,
    /// Status values: `"PAGADO"` | `"PENDIENTE"` | `"MORA"`
    pub status: String,
}

/// Payload for recording a rent payment.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NewRentPaymentInput {
    pub contract_id: i64,
    pub property_id: i64,
    pub period_month: String,
    pub gross_amount_cop: i64,
    pub payment_date: String,
    pub payment_method: String,
    pub reference_code: String,
    pub status: String,
}

/// Maintenance execution order with local receipt and evidence photo paths.
/// Deducted 1:1 at net cost (`net_cost_cop`) during monthly owner settlements.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MaintenanceExpense {
    pub id: i64,
    pub property_id: i64,
    pub execution_date: String,
    pub category: String,
    pub description: String,
    pub technician_name: String,
    pub invoice_number: String,
    pub net_cost_cop: i64,
    pub receipt_image_path: String,
    pub evidence_images_paths: Vec<String>,
    /// Status values: `"Por Liquidar"` | `"Liquidado"`
    pub deduction_status: String,
    pub settlement_id: Option<i64>,
}

/// Payload for registering a new maintenance expense.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NewMaintenanceInput {
    pub property_id: i64,
    pub execution_date: String,
    pub category: String,
    pub description: String,
    pub technician_name: String,
    pub invoice_number: String,
    pub net_cost_cop: i64,
    pub receipt_image_path: String,
    pub evidence_images_paths: Vec<String>,
}

/// Monthly settlement statement closing an owner's collected rent minus mixed commission and 1:1 maintenance costs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settlement {
    pub id: i64,
    pub owner_id: i64,
    pub period_month: String,
    pub gross_income_cop: i64,
    pub commission_amount_cop: i64,
    pub fixed_fee_amount_cop: i64,
    pub maintenance_deduction_cop: i64,
    pub net_payable_cop: i64,
    pub sha256_seal: String,
    /// Status value: `"EJECUTADO"`
    pub status: String,
    pub created_at: String,
}

/// Complete single-read bundle for the global Master Owner Selector, engineered for <300ms reactivity.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OwnerDashboardBundle {
    pub selected_owner: Owner,
    pub all_owners: Vec<Owner>,
    pub properties: Vec<Property>,
    pub contracts: Vec<TenantContract>,
    pub payments: Vec<RentPayment>,
    pub maintenances: Vec<MaintenanceExpense>,
    pub settlements: Vec<Settlement>,
    pub agency_total_properties: usize,
    pub owner_property_count: usize,
    pub agency_participation_pct: f64,
    pub expected_monthly_collection_cop: i64,
    pub collected_monthly_cop: i64,
    pub pending_maintenance_cop: i64,
    pub occupancy_rate_pct: f64,
}
