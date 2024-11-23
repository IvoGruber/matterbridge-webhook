import {
  onOffOutlet,
  OnOffCluster,
  PlatformConfig,
  powerSource,
} from 'matterbridge';
import { Matterbridge, MatterbridgeDevice, MatterbridgeDynamicPlatform } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { DeviceConfig } from './config.js'

export class ExampleMatterbridgeDynamicPlatform extends MatterbridgeDynamicPlatform {
  outlets: Array<MatterbridgeDevice | undefined> = [];

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('1.6.0')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "1.6.0". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend."`,
      );
    }

    this.log.info('Initializing platform:', this.config.name);
  }

  async callGetWebhook(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
        },
      });
  
      if (!response.ok) {
        throw new Error(`Failed to call webhook: ${response.statusText}`);
      }
  
      const data = await response.json();
      this.log.info('Webhook response:', data);
    } catch (error) {
      this.log.error('Error calling webhook:', error);
      return false;
    }
    return true;
  }

  async callPostWebhook(url: string, payload: object): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to call webhook: ${response.statusText}`);
      }
  
      const data = await response.json();
      this.log.info('Webhook response:', data);
    } catch (error) {
      this.log.error('Error calling webhook:', error);
      return false;
    }
    return true;
  }

  wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createWebhookOutlet(config: DeviceConfig): Promise<MatterbridgeDevice> {
    const outlet = new MatterbridgeDevice(onOffOutlet, undefined, this.config.debug as boolean);
    outlet.log.logName = config.name;
    outlet.createDefaultIdentifyClusterServer();
    outlet.createDefaultGroupsClusterServer();
    outlet.createDefaultBridgedDeviceBasicInformationClusterServer(
      config.name, config.serialNumber, 0xfff1, 'Websocket', 'Matterbridge Outlet'
    );
    outlet.createDefaultOnOffClusterServer();
    outlet.addDeviceType(powerSource);
    outlet.createDefaultPowerSourceWiredClusterServer();
    await this.registerDevice(outlet);

    outlet.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      outlet.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    outlet.addCommandHandler('on', async () => {
      let webcallOk: boolean = false;
      switch (config.method) {
        case 'GET': 
          webcallOk = await this.callGetWebhook(config.url);
        break;
        case 'POST':
          webcallOk = await this.callPostWebhook(config.url, config.payload ? config.payload : {});
          break;
        default:
          this.log.error('invalid method for device:', config.name);
      }
      if (webcallOk) {
        outlet.setAttribute(OnOffCluster.id, 'onOff', true, outlet.log, outlet);
        outlet.log.info('Command on called');
        await this.wait(100);
        outlet.setAttribute(OnOffCluster.id, 'onOff', false, outlet.log, outlet);
        outlet.log.info('Command off called');
      }
    });
    return outlet;
  }

  override async onStart(reason?: string) {
    this.log.info('onStart called with reason:', reason ?? 'none');
    const webhooks = this.config.webhookList as Array<DeviceConfig>;
    webhooks.forEach(async (webhook) => {
      const outlet = await this.createWebhookOutlet(webhook);
      this.outlets.push(outlet);
    });
  }

  override async onConfigure() {
    this.log.info('onConfigure called');
    this.outlets.forEach((outlet) => {
      // Set outlet to off
      outlet?.setAttribute(OnOffCluster.id, 'onOff', false, outlet.log);
      outlet?.log.info('Set outlet initial onOff to false');
    });
  }

  override async onShutdown(reason?: string) {
    this.log.info('onShutdown called with reason:', reason ?? 'none');
    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }
}
