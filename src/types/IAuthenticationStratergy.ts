export interface IAuthenticationStratergy {
    verify(key: string): Promise<boolean>;
}