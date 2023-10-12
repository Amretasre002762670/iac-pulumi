require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const config = new pulumi.Config('devPulumiConfig');

function createPublicRouteTable(vpc, gw, routeTableName) {
    const routeTable = new aws.ec2.RouteTable(routeTableName, {
        vpcId: vpc.id, 
        tags: {
            Name: routeTableName,
            // Environment: awsProfile
        },
        routes: [
            {
                cidrBlock: config.require('fallBackRoute'),
                gatewayId: gw.id,
            },
        ],
    });
    return routeTable;
}

function createPrivateRouteTable(vpc, routeTableName) {
    const routeTable = new aws.ec2.RouteTable(routeTableName, {
        vpcId: vpc.id, 
        tags: {
            Name: routeTableName,
            // Environment: awsProfile
        },
        routes: [], // A private route table should not have default route
    });
    return routeTable;
}

module.exports = {
    createPublicRouteTable,
    createPrivateRouteTable
}