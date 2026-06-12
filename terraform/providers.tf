terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
  }

  backend "azurerm" {
    # These values should be provided via backend config file or CLI during init
    # resource_group_name  = "tfstate-rg"
    # storage_account_name = "tfstatestoragewapi"
    # container_name       = "tfstate"
    # key                  = "wapi.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}
