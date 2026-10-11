ALTER TABLE `settings` ADD `auth_mode` text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_issuer_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_client_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_client_secret_sealed` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_scopes` text DEFAULT 'openid profile email' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_login_label` text DEFAULT 'Sign in with OIDC' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `saml_entry_point` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `saml_issuer` text DEFAULT 'urn:aigate:sp' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `saml_cert_sealed` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `saml_attribute_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `saml_attribute_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `sso_public_origin` text DEFAULT '' NOT NULL;
