locals {
  region = get_env("AWS_REGION")
  stage  = get_env("AWS_STAGE")
  stages = {
    localstack = {
      name = "Localstack"
    }
    test = {
      name = "Testing"
    }
    prod = {
      name = "Production"
    }
  }
  service_name   = "tvo-mcp-gateway"
  parameter_path = "/tvo/security-scan"
  service_bucket = "tvo-mcp-tfstate-gateway"
  tags_file_path = "${get_terragrunt_dir()}/common_tags.json"
  log_retention  = 7
  common_tags = fileexists(local.tags_file_path) ? jsondecode(file(local.tags_file_path)) : {
    Project = "Titvo MCP Gateway"
  }
}
