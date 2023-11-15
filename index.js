require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const subnetsModule = require("./resources/subnet");
const routeTable = require("./resources/routeTable");
const routeTableAssociation = require("./resources/routeTableAssociation");
const route = require("./resources/publicRoute");
const subnetCidr = require("./utils/generateCidr");
const role = require("./resources/iamRole");

const config = new pulumi.Config('devPulumiConfig');

const main = new aws.ec2.Vpc(config.require('vpcName'), {
    cidrBlock: config.require('defaultCidr'),
    instanceTenancy: "default",
    tags: {
        Name: config.require('vpcName'),
    },
});

const igw = new aws.ec2.InternetGateway(config.require('igwName'), {
    vpcId: main.id,
    tags: {
        Name: config.require('igwName'),
    },
});

// Create Public Route Table
const publicRouteTable = routeTable.createPublicRouteTable(main, igw, config.require('publicRoutingTableName'));

// Create Private Route Table
const privateRouteTable = routeTable.createPrivateRouteTable(main, config.require('privateRoutingTableName'));

// const rdsEndpoint = pulumi.interpolate`${rdsInstance.endpoint}`;

const mainNetwork = config.require('defaultCidr');
const subnetMask = config.require('subnetMask');
const selectedRegion = config.require('selectedRegion');

const created_subnet_arr = [];
const private_subnet_arr = [];
const domainName = config.require('domainName');
const port = config.require('port');

// Create an IAM role
const cloudwatch_role = role.createIAMRole(config.require('cloudwatchRoleName'), config.require('cloudWatchPolicy'));

const instanceProfile = new aws.iam.InstanceProfile(config.require("instanceProfileName"), {
    name: config.require("instanceProfileName"),
    role: cloudwatch_role.name,
});

async function createSubnet() {
    try {
        const selectedRegionAvailabilityZones = await aws.getAvailabilityZones({
            state: "available",
            region: selectedRegion,
        });

        const hostedZone = aws.route53.getZone({
            name: domainName,
        });

        const selectedRegionAvailabilityZonesLength = (selectedRegionAvailabilityZones.names || []).length;
        const maxSubnets = 3; // Maximum subnets to create (both public and private)
        const totalSubnets = Math.min(selectedRegionAvailabilityZonesLength, maxSubnets)

        const baseIp = config.require("defaultCidr");
        const subnetMask = config.require("subnetMask");  // Subnet mask in bits (e.g., 24 for /24)

        const subnets_arr = subnetCidr.generateCidr(baseIp, totalSubnets * 2, subnetMask);


        // Split the subnets_arr into public and private subnets
        const publicSubnetsCidr = subnets_arr.slice(0, totalSubnets);
        const privateSubnetsCidr = subnets_arr.slice(totalSubnets);

        for (let i = 0; i < totalSubnets; i++) {
            const availabilityZone = selectedRegionAvailabilityZones.names[i];
            const publicSubnetCidr = publicSubnetsCidr[i];
            const privateSubnetCidr = privateSubnetsCidr[i];

            // Create the public subnets using your existing functions
            const publicSubnet = subnetsModule.createSubnets(main, `csye6225-public-subnet-${i + 1}`, availabilityZone, publicSubnetCidr);
            created_subnet_arr.push(publicSubnet);

            const privateSubnet = subnetsModule.createSubnets(main, `csye6225-private-subnet-${i + 1}`, availabilityZone, privateSubnetCidr);
            private_subnet_arr.push(privateSubnet);

            // Create route table associations as needed
            const subnetPublicAssociation = routeTableAssociation.createRouteTableAssociation(
                publicRouteTable,
                publicSubnet,
                `csye6225-public-routing-association-${i + 1}`
            );

            const subnetPrivateAssociation = routeTableAssociation.createRouteTableAssociation(
                privateRouteTable,
                privateSubnet,
                `csye6225-private-routing-association-${i + 1}`
            );
        }

        // for (let i = 0; i < totalSubnets; i++) {
        //     const availabilityZone = selectedRegionAvailabilityZones.names[i];
        //     const privateSubnetCidr = privateSubnetsCidr[i];

        //     // Create the private subnets using your existing functions
        //     const privateSubnet = subnetsModule.createSubnets(main, `csye6225-private-subnet-${i + 1}`, availabilityZone, privateSubnetCidr);

        //     // Create route table associations as needed
        //     const subnetPrivateAssociation = routeTableAssociation.createRouteTableAssociation(
        //         privateRouteTable,
        //         privateSubnet,
        //         `csye6225-private-routing-association-${i + 1}`
        //     );
        // }

        const publicRoute = route.createPublicRoutes(publicRouteTable, igw, config.require('publicRouteName'));

        const loadBalancerSecurityGroup = new aws.ec2.SecurityGroup(config.require("loadBalancerSg"), {
            vpcId: main.id,
            description: "Load Balancer Security Group",
            ingress: [
                {
                    protocol: config.require('protocol'),
                    fromPort: config.require('http_from_port'),
                    toPort: config.require('http_to_port'),
                    cidrBlocks: [config.require('ipv4')],
                },
                {
                    protocol: config.require('protocol'),
                    fromPort: config.require('https_from_port'),
                    toPort: config.require('https_to_port'),
                    cidrBlocks: [config.require('ipv4')],
                },
            ],
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: {
                Name: config.require('loadBalancerSg'),
            },
        });

        const sg = new aws.ec2.SecurityGroup(config.require('sgName'), {
            vpcId: main.id,
            description: "CSYE6225 Security group for Node app",
            ingress: [
                {
                    fromPort: config.require('ssh_from_port'), //SSH
                    toPort: config.require('ssh_to_port'),
                    protocol: config.require('protocol'),
                    cidrBlocks: [config.require('ipv4')],
                },
                // {
                //     fromPort: config.require('http_from_port'), //HTTP
                //     toPort: config.require('http_from_port'),
                //     protocol: config.require('protocol'),
                //     cidrBlocks: [config.require('ipv4')],
                //     // ipv6CidrBlocks: [config.config['iac-pulumi:ipv6_cidr_blocks']], 
                // },
                // {
                //     fromPort: config.require('https_from_port'), //HTTPS
                //     toPort: config.require('https_from_port'),
                //     protocol: config.require('protocol'),
                //     cidrBlocks: [config.require('ipv4')],
                //     // ipv6CidrBlocks: [config.config['iac-pulumi:ipv6_cidr_blocks']], 
                // },
                {
                    fromPort: config.require('webapp_from_port'), //your port
                    toPort: config.require('webapp_from_port'),
                    protocol: config.require('protocol'),
                    // cidrBlocks: [config.require('ipv4')],
                    securityGroups: [loadBalancerSecurityGroup.id],
                    // ipv6CidrBlocks: [config.config['iac-pulumi:ipv6_cidr_blocks']], 
                },
            ],
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: {
                Name: config.require('sgName'),
            },
        });

        const customParameterGroup = new aws.rds.ParameterGroup(config.require("rdsName"), {
            family: config.require('dbTypePg'),
            description: "Custom parameter group for csye 6225 db",
            parameters: [
                {
                    name: "max_connections",
                    value: config.require('dbMaxConnections'),
                },
            ],
            tags: {
                Name: config.require("rdsName"),
            },
        });

        const mySubnetGroup = new aws.rds.SubnetGroup(config.require('subnetGroupName'), {
            subnetIds: private_subnet_arr.map(subnet => subnet.id),
            tags: {
                Name: config.require('subnetGroupName'),
            }, // Use the appropriate subnets (e.g., public or private)
        });

        const sgDB = new aws.ec2.SecurityGroup(config.require('sgRDSName'), {
            vpcId: main.id,
            description: "CSYE6225 Security group for Node app",
            ingress: [
                {
                    fromPort: config.require('db_from_port'),
                    toPort: config.require('db_to_port'),
                    protocol: config.require('protocol'),
                    securityGroups: [sg.id]
                },
            ],
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: {
                Name: config.require('sgRDSName'),
            },
        });

        const dbInstance = new aws.rds.Instance(config.require("dbInstanceName"), {
            allocatedStorage: 20,
            storageType: "gp2",
            instanceClass: "db.t3.micro",
            engine: config.require("dbEngine"),
            dbName: config.require("dbName"),
            username: config.require("dbInstanceUserName"),
            password: config.require("dbInstancePassword"),
            parameterGroupName: customParameterGroup.name,
            dbSubnetGroupName: mySubnetGroup.name,
            skipFinalSnapshot: true,
            vpcSecurityGroupIds: [sgDB.id],
            publiclyAccessible: false,
            // provisioned: {
            //     maxRetries: 10,
            //     retryInterval: 10,
            // },
        });

        const dbEndpoint = dbInstance.endpoint;
        const dbHost = dbEndpoint.apply(endpoint => endpoint.split(":")[0]);
        let userDataScript = dbHost.apply(host =>
            `#!/bin/bash
            echo "Setting up environment variables"

            echo 'export HOST=${host}' >> /etc/environment
            echo 'export MYSQLUSER=${config.require("dbInstanceUserName")}' >> /etc/environment
            echo 'export PASSWORD=${config.require("dbInstancePassword")}' >> /etc/environment

            source /etc/environment

            echo "HOST is: $HOST"
            echo "MYSQLUSER is: $MYSQLUSER"

            sudo systemctl daemon-reload

            sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a append-config -m ec2 -c file:/opt/cloudwatch-config.json -s

            sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/dist/cloudwatch-config.json -s

            sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a stop
            sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a start

            sudo systemctl enable Assignment-node-app.service
            sudo systemctl start Assignment-node-app.service
            `
        );

        // Create an EC2 instance
        // const ec2Instance = new aws.ec2.Instance(config.require("ec2InstanceName"), {
        //     ami: config.require("amiId"),
        //     iamInstanceProfile: instanceProfile.name,
        //     instanceType: "t2.micro",
        //     subnetId: created_subnet_arr[0].id,
        //     keyName: config.require('keyName'),
        //     associatePublicIpAddress: true,
        //     vpcSecurityGroupIds: [sg.id,],
        //     securityGroupIds: [sg.id],
        //     rootBlockDevice: {
        //         volumeType: "gp2",
        //         volumeSize: 25,
        //         deleteOnTermination: true,
        //     },
        //     creditSpecification: {
        //         cpuCredits: "standard",
        //     },
        //     tags: {
        //         Name: config.require("ec2InstanceName"),
        //     },
        //     userData: userDataScript
        // });


        const launchTemplate = new aws.ec2.LaunchTemplate(config.require("launchTemplate"), {
            name: config.require("launchTemplate"),
            imageId: config.require("amiId"),
            instanceType: "t2.micro",
            keyName: config.require('keyName'),
            userData: pulumi.interpolate`${userDataScript}`.apply(script =>Buffer.from(script).toString('base64')),
            iamInstanceProfile: {
                name: instanceProfile.name,
            },
            networkInterfaces: [
                {
                    associatePublicIpAddress: true,
                    securityGroups: [sg.id],
                    subnetId: created_subnet_arr[0].id,
                },
            ],
            tags: {
                Name: config.require("launchTemplate"),
            }
        });

        const targetGroup = new aws.lb.TargetGroup(config.require("targetGroupName"), {
            port: config.require("port"),
            protocol: "HTTP",
            targetType: "instance",
            vpcId: main.id,
            healthCheck: {
                enabled: true,
                healthyThreshold: config.require("healthyThreshold"),
                path: config.require("healthRoute"),
                port: config.require("port"),
                protocol: config.require("protocolTG"),
                interval: config.require("intervalTG"),
                timeout: config.require("timeoutTG"),
            },
        },
            {
                dependsOn: [dbInstance], // Specify the dependency on the RDS instance
            }
        );

        const autoScalingGroup = new aws.autoscaling.Group(config.require("autoScalingGroup"), {
            vpcZoneIdentifiers: created_subnet_arr,
            launchTemplate: {
                id: launchTemplate.id,
                version: "$Latest",
            },
            minSize: config.require("AsMinTries"),
            maxSize: config.require("AsMaxTries"),
            desiredCapacity: config.require("AsDesiredCapacity"),
            targetGroupArns: [targetGroup.arn],
            defaultCooldown: config.require("AsDefaultCooldown"),
            // healthCheckType: "EC2",
            // healthCheckGracePeriod: 300,
            tags: [
                {
                    key: "Name",
                    value: config.require("autoScalingGroup"),
                    propagateAtLaunch: true,
                },
            ],
        });

        const scaleUpPolicy = new aws.autoscaling.Policy(config.require("scaleUpPolicy"), {
            scalingAdjustment: config.require("scalingUpAdjustments"),
            adjustmentType: config.require("adjustmentType"),
            cooldown: config.require("coolDown"),
            autoscalingGroupName: autoScalingGroup.name,
            policyType: config.require("policyType"),
        });

        const scaleDownPolicy = new aws.autoscaling.Policy(config.require("scaleDownPolicy"), {
            scalingAdjustment: config.require("scalingDownAdjustments"),
            adjustmentType: config.require("adjustmentType"),
            cooldown: config.require("coolDown"),
            autoscalingGroupName: autoScalingGroup.name,
            policyType: config.require("policyType"),
        });

        const cpuAlarmScaleUp = new aws.cloudwatch.MetricAlarm(config.require("cpuAlarmScaleUpName"), {
            alarmName: config.require("cpuAlarmScaleUpName"),
            comparisonOperator: "GreaterThanThreshold",
            evaluationPeriods: config.require("evaluationPeriods"),
            threshold: config.require("scalingUpThreshold"),
            namespace: "AWS/EC2",
            metricName: config.require("scalingMetricName"),
            period: config.require("scalingPeriod"),
            statistic: config.require("scalingStatistic"),
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleUpPolicy.arn],
            actionsEnabled: true,
        });

        const cpuAlarmScaleDown = new aws.cloudwatch.MetricAlarm(config.require("cpuAlarmScaleDownName"), {
            alarmName: config.require("cpuAlarmScaleUpName"),
            comparisonOperator: "LessThanThreshold",
            evaluationPeriods: config.require("evaluationPeriods"),
            threshold: config.require("scalingDownThreshold"),
            namespace: "AWS/EC2",
            metricName: config.require("scalingMetricName"),
            period: config.require("scalingPeriod"),
            statistic: "Average",
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleDownPolicy.arn],
            actionsEnabled: true,
        });

        const loadBalancer = new aws.lb.LoadBalancer(config.require("loadBalancerName"), {
            internal: false,
            enableDeletionProtection: false,
            securityGroups: [loadBalancerSecurityGroup.id],
            subnets: created_subnet_arr,
            // enableHttp2: true,
            // enableCrossZoneLoadBalancing: true,
            // idleTimeout: 60,
            loadBalancerType: "application",
            ipAddressType: config.require("loadBalancerIPType"),
        });

        const httpListener = new aws.lb.Listener(config.require("httpListnerName"), {
            loadBalancerArn: loadBalancer.arn,
            port: config.require("httpListnerPort"),
            protocol: config.require("protocolTG"),
            defaultActions: [
                {
                    type: config.require("httpListnerDefaultType"),
                    targetGroupArn: targetGroup.arn,
                },
            ],
        });

        const zoneId = hostedZone.then(zone => zone.id);

        const aRecord = new aws.route53.Record(
            config.require("route53Name"),
            {
                name: domainName,
                type: "A",
                zoneId: zoneId,
                // ttl: config.require("ttl"),
                aliases: [
                    {
                        evaluateTargetHealth: true,
                        name: loadBalancer.dnsName,
                        zoneId: loadBalancer.zoneId,
                    },
                ],
                tags: {
                    Name: config.require("route53Name"),
                },
            },
        );

    } catch (error) {
        console.error("Error while creating subnets:", error);
    }
}

createSubnet();


