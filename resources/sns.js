const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const config = new pulumi.Config('devPulumiConfig');

async function snsArn() {
    const snsArn = pulumi.output(config.require('snsTopic')).apply((snsTopicName) => {
        const snsTopic = new aws.sns.Topic(snsTopicName);
        return snsTopic.arn;
    });
    return snsArn;
}

module.exports = {
    snsArn,
};