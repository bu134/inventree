import { AxiosInstance } from 'axios';

import { ModelType } from '../../enums/ModelType';

/*
 * A set of properties which are passed to a plugin,
 * for rendering an element in the user interface.
 *
 * @param pluginName - The name of the plugin
 * @param target - The target HTML element to render the plugin into
 * @param model - The model type for the plugin (e.g. 'part' / 'purchaseorder')
 * @param id - The ID (primary key) of the model instance for the plugin
 * @param instance - The model instance data (if available)
 * @param serverParams - Extra parameters passed from the server
 * @param api - The Axios API instance (see ../states/ApiState.tsx)
 * @param user - The current user instance (see ../states/UserState.tsx)
 * @param navigate - The navigation function (see react-router-dom)
 */
export type PluginContext = {
  pluginName: string;
  target: HTMLDivElement | undefined;
  model?: ModelType | string;
  id?: string | number | null;
  instance?: any;
  serverParams?: any;
  api: AxiosInstance;
  user: any;
  host: string;
  navigate: any;
};
