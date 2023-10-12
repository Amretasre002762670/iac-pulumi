require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const subnetsModule = require("./resources/subnet");
const routeTable = require("./resources/routeTable");
const routeTableAssociation = require("./resources/routeTableAssociation");
const route = require("./resources/publicRoute");
const subnetCidr = require("./utils/generateCidr");

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


const mainNetwork = config.require('defaultCidr');
const totalSubnets = config.require('totalSubnets');
const subnetMask = config.require('subnetMask');


const subnets_arr = subnetCidr.generateCidr(mainNetwork, totalSubnets, subnetMask);

for (let i = 0; i < totalSubnets; i++) {
    const availabilityZone = `us-east-1${String.fromCharCode(97 + (i % 3))}`;
    const isPublic = i < 3; // First 3 subnets are public, the rest are private
    const subnetName = isPublic ? `csye6225-public-subnet-${i + 1}` : `csye6225-private-subnet-${i + 1}`;
    const subnetAssociationName = isPublic ? `csye6225-public-routing-association-${i + 1}` : `csye6225-private-routing-association-${i + 1}`;

    const subnets = subnetsModule.createSubnets(main, subnetName, availabilityZone, subnets_arr[i].toString());

    const subnetAssociation = routeTableAssociation.createRouteTableAssociation(isPublic ? publicRouteTable : privateRouteTable, subnets, subnetAssociationName);
}

const publicRoute = route.createPublicRoutes(publicRouteTable, igw, config.require('publicRouteName'));
