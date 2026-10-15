pub mod backup;
pub mod db;
pub mod models;
pub mod paths;

#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::TempDir;

    use crate::backup::run_vacuum_into_backup;
    use crate::db::{
        calculate_property_commission, create_maintenance_expense, create_property,
        execute_monthly_settlement, execute_property_handover, get_contract_by_id,
        get_journal_mode, get_owner_dashboard_bundle, get_property_by_id, init_database,
        seed_if_empty,
    };
    use crate::models::{NewMaintenanceInput, NewPropertyInput};
    use crate::paths::AppPaths;

    #[test]
    fn test_wal_journal_mode_and_local_paths() {
        let temp = TempDir::new().expect("tempdir creation must succeed");
        let app_paths = AppPaths::from_root(temp.path().to_path_buf())
            .expect("AppPaths from_root must succeed");

        let conn = init_database(&app_paths.db_file).expect("init_database must succeed");
        let mode = get_journal_mode(&conn).expect("get_journal_mode must succeed");
        assert_eq!(mode.to_lowercase(), "wal");

        // Verify local evidence image storage returns normalized relative path
        let stored_rel = app_paths
            .store_evidence_bytes("recibo plomeria #101.jpg", b"fake-jpeg-binary")
            .expect("store_evidence_bytes must succeed");
        assert_eq!(stored_rel, "evidencias/recibo_plomeria__101.jpg");
        assert!(app_paths
            .evidencias_dir
            .join("recibo_plomeria__101.jpg")
            .exists());
    }

    #[test]
    fn test_schema_v4_hierarchy_and_maintenance_json_persistence() {
        let temp = TempDir::new().expect("tempdir creation must succeed");
        let app_paths = AppPaths::from_root(temp.path().to_path_buf()).unwrap();
        let mut conn = init_database(&app_paths.db_file).unwrap();
        let seeded = seed_if_empty(&mut conn).expect("seed_if_empty must succeed");
        assert!(seeded);

        // Verify idempotency of seed_if_empty
        let seeded_again = seed_if_empty(&mut conn).unwrap();
        assert!(!seeded_again);

        // Verify parent_property_id self-referencing hierarchy on Owner 1
        let sub_prop = create_property(
            &conn,
            &NewPropertyInput {
                owner_id: 1,
                parent_property_id: Some(1),
                code: "SUB-FACA-201".to_string(),
                title: "Torre 1 - Apto 201".to_string(),
                address: "Cra 2 # 5-48 Apto 201, Facatativá".to_string(),
                property_type: "APARTAMENTO".to_string(),
                base_rent_cop: 1_600_000,
                commission_pct: 8.0,
                fixed_fee_cop: 45_000,
                cutoff_day: 5,
                status: "DISPONIBLE".to_string(),
            },
        )
        .expect("create child property must succeed");

        assert_eq!(sub_prop.parent_property_id, Some(1));

        // Verify maintenance_expenses receipt_image_path and evidence_images_paths JSON array roundtrip
        let maint = create_maintenance_expense(
            &conn,
            &NewMaintenanceInput {
                property_id: sub_prop.id,
                execution_date: "2026-10-15".to_string(),
                category: "CERRAJERÍA".to_string(),
                description: "Instalación cerradura digital de alta seguridad".to_string(),
                technician_name: "Seguridad Total Sabana".to_string(),
                invoice_number: "FAC-9910".to_string(),
                net_cost_cop: 195_000,
                receipt_image_path: "evidencias/recibo_cerrajeria_201.jpg".to_string(),
                evidence_images_paths: vec![
                    "evidencias/puerta_antes_201.jpg".to_string(),
                    "evidencias/cerradura_instalada_201.jpg".to_string(),
                ],
            },
        )
        .expect("create_maintenance_expense must succeed");

        assert_eq!(maint.deduction_status, "Por Liquidar");
        assert_eq!(
            maint.receipt_image_path,
            "evidencias/recibo_cerrajeria_201.jpg"
        );
        assert_eq!(
            maint.evidence_images_paths,
            vec![
                "evidencias/puerta_antes_201.jpg".to_string(),
                "evidencias/cerradura_instalada_201.jpg".to_string()
            ]
        );
    }

    #[test]
    fn test_mixed_commission_formula_and_transactional_monthly_settlement() {
        // Formula verification: (Gross * %) + Base Fixed Fee
        // 1,500,000 * 8% = 120,000 + 45,000 = 165,000
        let (pct_fee, total_fee) = calculate_property_commission(1_500_000, 8.0, 45_000);
        assert_eq!(pct_fee, 120_000);
        assert_eq!(total_fee, 165_000);

        let temp = TempDir::new().unwrap();
        let app_paths = AppPaths::from_root(temp.path().to_path_buf()).unwrap();
        let mut conn = init_database(&app_paths.db_file).unwrap();
        seed_if_empty(&mut conn).unwrap();

        // Owner 1 (Fabián Vargas Correa) in 2026-10 has:
        // - Property 2 (Apto 101): PAGADO 1,500,000 | 8.0% (120,000) + Fixed 45,000
        // - Property 4 (Local 01): PAGADO 2,800,000 | 10.0% (280,000) + Fixed 60,000
        // - Property 5 (Bodega): MORA 4,200,000 (not collected, excluded from PAGADO gross)
        // Total Gross = 4,300,000
        // Total % Commission = 120,000 + 280,000 = 400,000
        // Total Fixed Fee = 45,000 + 60,000 = 105,000
        // Pending 'Por Liquidar' Maintenances for Owner 1:
        // - Maint #1 (Prop 2): 285,000
        // - Maint #2 (Prop 4): 340,000
        // Total 1:1 Maintenance Deduction = 625,000
        // Expected Net Payable = 4,300,000 - (400,000 + 105,000) - 625,000 = 3,170,000
        let settlement = execute_monthly_settlement(&mut conn, 1, "2026-10")
            .expect("execute_monthly_settlement must commit cleanly");

        assert_eq!(settlement.owner_id, 1);
        assert_eq!(settlement.period_month, "2026-10");
        assert_eq!(settlement.gross_income_cop, 4_300_000);
        assert_eq!(settlement.commission_amount_cop, 400_000);
        assert_eq!(settlement.fixed_fee_amount_cop, 105_000);
        assert_eq!(settlement.maintenance_deduction_cop, 625_000);
        assert_eq!(settlement.net_payable_cop, 3_170_000);
        assert_eq!(settlement.status, "EJECUTADO");
        assert!(settlement.sha256_seal.starts_with("0x"));

        // Verify all Owner 1 maintenance expenses are now marked 'Liquidado'
        let bundle = get_owner_dashboard_bundle(&conn, 1).unwrap();
        assert_eq!(bundle.pending_maintenance_cop, 0);
        assert!(bundle
            .maintenances
            .iter()
            .all(|m| m.deduction_status == "Liquidado" && m.settlement_id.is_some()));
    }

    #[test]
    fn test_transactional_property_handover() {
        let temp = TempDir::new().unwrap();
        let app_paths = AppPaths::from_root(temp.path().to_path_buf()).unwrap();
        let mut conn = init_database(&app_paths.db_file).unwrap();
        seed_if_empty(&mut conn).unwrap();

        // Property 2 has active contract 1 and status 'OCUPADO'
        let prop_before = get_property_by_id(&conn, 2).unwrap();
        let contract_before = get_contract_by_id(&conn, 1).unwrap();
        assert_eq!(prop_before.status, "OCUPADO");
        assert_eq!(contract_before.status, "ACTIVO");

        // Execute atomic handover
        execute_property_handover(&mut conn, 2).expect("execute_property_handover must succeed");

        let prop_after = get_property_by_id(&conn, 2).unwrap();
        let contract_after = get_contract_by_id(&conn, 1).unwrap();
        assert_eq!(prop_after.status, "DISPONIBLE");
        assert_eq!(contract_after.status, "FINALIZADO");
    }

    #[test]
    fn test_vacuum_into_backup_and_30_day_rotation() {
        let temp = TempDir::new().unwrap();
        let app_paths = AppPaths::from_root(temp.path().to_path_buf()).unwrap();
        let mut conn = init_database(&app_paths.db_file).unwrap();
        seed_if_empty(&mut conn).unwrap();

        // Pre-populate 32 synthetic historical backup files to test the 30-file retention cap
        for day in 1..=32 {
            let fake_backup = app_paths
                .backups_dir
                .join(format!("inmo_backup_202601{:02}_000000_000.db", day));
            fs::write(&fake_backup, b"legacy-backupplaceholder").unwrap();
        }

        // Run live VACUUM INTO backup with retention_days = 30
        let latest_backup = run_vacuum_into_backup(&conn, &app_paths.backups_dir, 30)
            .expect("run_vacuum_into_backup must succeed");

        assert!(latest_backup.exists());

        // Verify the backup file produced by VACUUM INTO is a valid, queryable SQLite database
        let backup_conn = rusqlite::Connection::open(&latest_backup).unwrap();
        let owner_count: i64 = backup_conn
            .query_row("SELECT COUNT(*) FROM owners;", [], |r| r.get(0))
            .unwrap();
        assert_eq!(owner_count, 3);

        // Verify rotation pruned the directory to exactly 30 .db files
        let remaining_dbs: Vec<_> = fs::read_dir(&app_paths.backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s == "db")
                    .unwrap_or(false)
            })
            .collect();
        assert_eq!(remaining_dbs.len(), 30);
    }
}
