data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                       = "kv-wapi-prod-xy" # Must be globally unique, 3-24 characters
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = false

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Recover", "Backup", "Restore"
    ]
  }

  # Grant AKS Key Vault Secrets Provider identity access to read secrets
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_kubernetes_cluster.aks.key_vault_secrets_provider[0].secret_identity[0].object_id

    secret_permissions = [
      "Get", "List"
    ]
  }

  tags = azurerm_resource_group.rg.tags
}

# Example Secret - Add others manually or via CI/CD
resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = "your-production-jwt-secret-here"
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "internal_service_secret" {
  name         = "internal-service-secret"
  value        = "your-production-internal-service-secret-here"
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "mongo_uri" {
  name         = "mongo-uri"
  value        = azurerm_cosmosdb_account.mongodb.primary_mongodb_connection_string
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "redis_url" {
  name         = "redis-url"
  value        = "rediss://:${azurerm_redis_cache.redis.primary_access_key}@${azurerm_redis_cache.redis.hostname}:${azurerm_redis_cache.redis.ssl_port}"
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "kafka_broker" {
  name         = "kafka-broker"
  value        = "${azurerm_eventhub_namespace.eh_namespace.name}.servicebus.windows.net:9093"
  key_vault_id = azurerm_key_vault.kv.id
}
