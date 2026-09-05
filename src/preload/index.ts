import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/domain';
const api: DesktopApi = {
  bootstrap: () => ipcRenderer.invoke('tesir:bootstrap'),
  saveCustomer: (input) => ipcRenderer.invoke('tesir:save-customer', input),
  saveProduct: (input) => ipcRenderer.invoke('tesir:save-product', input),
  getDocument: (id) => ipcRenderer.invoke('tesir:get-document', id),
  saveDocument: (input) => ipcRenderer.invoke('tesir:save-document', input),
  saveSettings: (input) => ipcRenderer.invoke('tesir:save-settings', input),
  saveTemplate: (input) => ipcRenderer.invoke('tesir:save-template', input),
  addType: (input) => ipcRenderer.invoke('tesir:add-type', input),
  importImage: () => ipcRenderer.invoke('tesir:import-image'),
  exportPdf: (id) => ipcRenderer.invoke('tesir:export-pdf', id),
  printDocument: (id) => ipcRenderer.invoke('tesir:print', id),
  backup: () => ipcRenderer.invoke('tesir:backup'),
};
contextBridge.exposeInMainWorld('tesir', api);
