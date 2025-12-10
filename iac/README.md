## Infrastructure as Code for AWS's ECS

### IAC design notes
- TODO: Fill this out

## Deploying

### From GitHub (easier and preferred)
- TODO: Fill this out

### From a local environment

#### Make sure you have the local requirements:
- [node](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) >=20.9
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) >=10

#### Steps

Make sure you are in the iac directory:
```
cd [REPO_ROOT]/iac
```

Create iac/.env if you don't already have one.
```
cp .env.example .env
```

Fill out the environment variable values. 

The AWS ID and Key are required. All TF_VAR_* variables may be changed, or left on their defaults:
- **AWS_ACCESS_KEY_ID**: AWS Key ID for deploying infra.
- **AWS_SECRET_ACCESS_KEY**: AWS Key for deploying infra.
- **TF_VAR_project**: Project name. 
- **TF_VAR_service**: Service name.
- **TF_VAR_env**: Environment name.
- **TF_VAR_region**: AWS region to deploy infra.
- **TF_VAR_container_port**: Port number to expose.
- **TF_VAR_image_tag**: String for tagging image.
- **TF_VAR_az1**: First availability zone.
- **TF_VAR_az2**: Second availability zone.
- **TF_VAR_task_cpu**: CPU limit for container.
- **TF_VAR_task_memory**: Memory limit for container.

Run script to export .env to environment variables. **This must be done for each new console session**:
```
source ./local-env.sh
```

Install dependencies:
```
npm ci
```

(Optional) Run the synth command and check Terraform output at cdktf.out/stacks/cdk.tf.json
```
npm run synth
```

Deploy the infrastructure:
```
npm run deploy
```
(Optional) Check the AWS Web UI to confirm infra was created.

#### Manually build and push the image

TODO: Write bash script that automates this.

When the deploy completes, Terraform will return output variables to the console under "Outputs". For example:
```
ecr_registry_host = "012345678901.dkr.ecr.us-east-2.amazonaws.com"
```

Copy-paste *their values*, replacing the square brackets [], for the next commands:
```
aws ecr get-login-password --region $TF_VAR_region | docker login --username AWS --password-stdin [ecr_registry_host]
```
You should see a 'Login Succeeded' message.
```
cd ../app
docker build -t [ecr_repository_url] .
docker push [ecr_repository_url]
```

From the AWS UI, navigate to ECS -> Click the Cluster -> Click Service -> Tasks Tab.
The Service will have already tried to pull the image and may be pending/stopped. Wait for the service to recover now that the image is pullable.

Once it shows ready, you can confirm it is working with the health check:
```
curl [health_check_url]
{"status":"ok"}
```

Finally, clean up the infrastructure by destroying it:
```
npm run destroy
```

### Other Miscellaneous Notes

##### CDKTF new-project trick
While this is not necessary for running this *existing* project, there is an 
awkward trick to getting a *new* cdktf-cli project off the ground. This trick
gets around a catch-22 because:
- You need the cdktf-cli dependency to run 
`cdktf init --template="typescript" --local`
- The `cdktf init` command creates a new `package.json` file, and needs an empty
directory to do so
- The `cdktf init` command *does not* add the cdktf-cli to its package.json's
dev dependencies
- So you cannot use a source-controlled version of cdktf-cli from 
`package.json` to get a new cdktf project off the ground without this 
workaround:
```
# Create fresh directory
mkdir iac
cd iac

# Install cdktf-cli globally in order to do the init
npm install -g cdktf-cli
cdktf init --template="typescript" --local

# Uninstall the global package
npm uninstall -g cdktf-cli

# Finally, install the the versioned package to the created package.json
npm install --save-dev cdktf-cli

# Confirm that cdktf commands work
npx cdktf --help
```

This avoids having differences between machines due to global package version
differences.