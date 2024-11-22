export type DeviceConfig = {
    name: string,
    serialNumber: string 
    method: string,
    url: string,
    payload?: object,
 };
  
// TODO read from a config file
// TODO provide a config UI
export const config: Array<DeviceConfig> = [
    {
      name: 'Webhook-Get',
      serialNumber: 'webhook-01',
      method: 'GET',
      url: 'http://192.168.1.1/api/webhook/get',
    },
    {
      name: 'Webhook-Post',
      serialNumber: 'webhook-02',
      method: 'POST',
      url: 'http://192.168.1.1/api/webhook/post',
      payload: {},
    },
  ]
