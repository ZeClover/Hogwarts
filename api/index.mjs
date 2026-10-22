import { createHostedApplication } from '../dist/hosted.js';

const application=await createHostedApplication();
export default application.server;
