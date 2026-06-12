resource "azurerm_resource_group" "rg" {
  name     = "rg-wapi-prod"
  location = "East US" # Update as needed
  tags = {
    environment = "production"
    project     = "wApi"
  }
}
