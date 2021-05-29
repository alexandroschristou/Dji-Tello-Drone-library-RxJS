export class StateInterface {
    
    constructor(Tello) {
        this.telloClient = Tello;
        this.state_data = {
            mid: null,
            x: null,
            y: null,
            z: null,
            mpry: null,
            pitch: null,
            roll: null,
            yaw: null,
            vgx: null,
            vgy: null,
            vgz: null,
            templ: null,
            temph: null,
            tof: null,
            h: null,
            bat: null,
            baro: null,
            time: null,
            agx: null,
            agy: null,
            agz: null
        }
    }

    get_drone_state() {
        return this.state_data;
    }

    parse_state_data(data) {
        let state = data[0].trim();
        let additional_info = data[1];
        let parentObject = this;
        let res = state.split(";")
        res.forEach(function (el) {
            if (el.length > 1) {
                var x = el.split(":")
                parentObject.telloClient.StateInterface.get_drone_state()[x[0]].next(parseFloat(x[1]));
            }
        })
    }
}

