import { ClickableManager } from '../managers/clickableManager';

export class Presenter {
    public clickableManager = new ClickableManager();

    init = () => {
        this.clickableManager.init();
    }

    destroy = () => {
        this.clickableManager.destroy();
    }
}
