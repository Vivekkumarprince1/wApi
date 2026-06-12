resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-wapi-prod"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "wapiaks"

  default_node_pool {
    name       = "default"
    node_count = 3
    vm_size    = "Standard_DS2_v2" # Adjust VM size based on load
  }

  identity {
    type = "SystemAssigned"
  }

  # Enable the Azure Key Vault Secrets Provider
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  network_profile {
    network_plugin    = "kubenet"
    load_balancer_sku = "standard"
  }

  tags = azurerm_resource_group.rg.tags
}
