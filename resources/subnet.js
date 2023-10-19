require('dotenv').config();
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

function createSubnets(vpc, subnetName, availabilityZone, cidrBlock) {
    const subnet = new aws.ec2.Subnet(subnetName, {
        vpcId: vpc.id,
        cidrBlock: cidrBlock,
        availabilityZone:availabilityZone, 
        tags: {
            Name: subnetName,
        },
    });

    return subnet; 
}

module.exports = {
    createSubnets,
};


