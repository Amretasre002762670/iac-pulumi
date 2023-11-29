# iac-pulumi

## Commands needed for Pulumi

```bash
pulumi login --local
```
    
```bash
pulumi new
```


```bash
pulumi refresh
```


```bash
pulumi preview
```

   
```bash
pulumi stack init <stack-name>
```

   
```bash
pulumi stack select <stack-name>
```
    
    
```bash
pulumi stack export
```

    
```bash
pulumi destroy --target <URN_OF_THE_SUBNET>
```

```
cat /var/log/cloud-init.log
cat /var/log/cloud-init-output.log
```


Google Cloud Credentials saved in:
```
gcloud init
gcloud auth application-default login
pulumi config set gcp:project <your-gcp-project-id>
/Users/amretasrerengarajan/.config/gcloud/application_default_credentials.json
```



