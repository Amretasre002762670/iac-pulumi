# IaC-Pulumi

This repository contains infrastructure as code (IaC) using Pulumi, written in TypeScript. Pulumi allows you to create, deploy, and manage infrastructure on various cloud providers using code.

## Prerequisites

Before getting started, ensure you have the following installed:

- [Pulumi](https://www.pulumi.com/docs/get-started/install/)
- [Node.js](https://nodejs.org/en/download/) (which includes npm)
- [AWS CLI](https://aws.amazon.com/cli/) (if working with AWS)
- [Google Cloud SDK](https://cloud.google.com/sdk) (if working with GCP)

## Getting Started

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/iac-pulumi.git
   cd iac-pulumi
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Pulumi Login**

   Log in to Pulumi using local backend:

   ```bash
   pulumi login --local
   ```

4. **Create a New Pulumi Project**

   ```bash
   pulumi new
   ```

## Common Pulumi Commands

- **Refresh the Stack**

  Refresh the state of your stack:

  ```bash
  pulumi refresh
  ```

- **Preview Changes**

  Preview changes before applying them:

  ```bash
  pulumi preview
  ```

- **Initialize a New Stack**

  Initialize a new stack:

  ```bash
  pulumi stack init <stack-name>
  ```

- **Select a Stack**

  Select an existing stack:

  ```bash
  pulumi stack select <stack-name>
  ```

- **Export Stack State**

  Export the current state of the stack:

  ```bash
  pulumi stack export
  ```

- **Destroy Resources**

  Destroy specific resources by targeting their URN:

  ```bash
  pulumi destroy --target <URN_OF_THE_SUBNET>
  ```

## Additional Commands

- **View Cloud-Init Logs**

  ```bash
  cat /var/log/cloud-init.log
  cat /var/log/cloud-init-output.log
  ```

## Importing Certificates (AWS Example)

1. **Change Ownership of the Private Key**

   ```bash
   sudo chown amretasrerengarajan:staff private.key
   ```

2. **Import Certificate**

   ```bash
   aws acm import-certificate --certificate fileb:///Users/amretasrerengarajan/AccessKeysAWS/demo/ssl-demo/demo_donquixote_me.crt \
       --certificate-chain fileb:///Users/amretasrerengarajan/AccessKeysAWS/demo/ssl-demo/demo_donquixote_me.ca-bundle \
       --private-key fileb:///Users/amretasrerengarajan/AccessKeysAWS/demo/ssl-demo/private.key
   ```

## Google Cloud Configuration

1. **Initialize Google Cloud SDK**

   ```bash
   gcloud init
   ```

2. **Authenticate with Google Cloud**

   ```bash
   gcloud auth application-default login
   ```

3. **Set Pulumi Config for GCP**

   ```bash
   pulumi config set gcp:project <your-gcp-project-id>
   ```

4. **Google Cloud Credentials Path**

   ```bash
   /Users/amretasrerengarajan/.config/gcloud/application_default_credentials.json
   ```

## Directory Structure

```
iac-pulumi/
├── index.ts            # Main Pulumi program
├── package.json        # Node.js dependencies
├── Pulumi.yaml         # Pulumi project configuration
├── Pulumi.<stack>.yaml # Pulumi stack configuration (replace <stack> with your stack name)
└── README.md           # This readme file
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---



