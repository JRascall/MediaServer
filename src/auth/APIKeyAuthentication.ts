import { IAuthenticationStratergy } from "../types/IAuthenticationStratergy";

export class APIKeyAuthentication implements IAuthenticationStratergy {
    constructor(
        private _keys: string[] = []
    ) 
    {
        
    }


    public async verify(key: string): Promise<boolean> {
        return this._keys.includes(key);
    }
}