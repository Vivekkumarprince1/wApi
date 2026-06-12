# -----------------------------------------------------------------------------
# Azure Cosmos DB (MongoDB API)
# -----------------------------------------------------------------------------
resource "azurerm_cosmosdb_account" "mongodb" {
  name                = "cosmos-wapi-prod" # Must be globally unique
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  offer_type          = "Standard"
  kind                = "MongoDB"

  capabilities {
    name = "EnableMongo"
  }

  consistency_policy {
    consistency_level       = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  geo_location {
    location          = azurerm_resource_group.rg.location
    failover_priority = 0
  }

  tags = azurerm_resource_group.rg.tags
}

# -----------------------------------------------------------------------------
# Azure Cache for Redis
# -----------------------------------------------------------------------------
resource "azurerm_redis_cache" "redis" {
  name                = "redis-wapi-prod" # Must be globally unique
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  capacity            = 1
  family              = "C"
  sku_name            = "Standard"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"

  tags = azurerm_resource_group.rg.tags
}

# -----------------------------------------------------------------------------
# Azure Event Hubs (Kafka API)
# -----------------------------------------------------------------------------
resource "azurerm_eventhub_namespace" "eh_namespace" {
  name                = "evhns-wapi-prod" # Must be globally unique
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
  capacity            = 1

  tags = azurerm_resource_group.rg.tags
}

# Add standard topics (Event Hubs) that the services might need.
# Expand this list based on the actual Kafka topics used by your application.
resource "azurerm_eventhub" "eh_default" {
  name                = "default-topic"
  namespace_name      = azurerm_eventhub_namespace.eh_namespace.name
  resource_group_name = azurerm_resource_group.rg.name
  partition_count     = 2
  message_retention   = 1
}
