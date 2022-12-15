import { Scheduler, paginateListSchedules, GetScheduleCommand } from "@aws-sdk/client-scheduler";

const scheduler = new Scheduler({});

type event = {
    expectedRelevantScheduleNames: string[]
}

export const handler = async (event: event) => {
    console.log('event', event);
    const paginator = await paginateListSchedules({
        client: scheduler,
    }, {});

    const schedules = [];
    for await (const page of paginator) {
        if (page.Schedules) {
            schedules.push(...page.Schedules);
        }
    }

    const isSameLength = event.expectedRelevantScheduleNames.length === schedules.length;
    const includesAll = schedules.map(({ Name }) => Name as string).every((scheduleName) => event.expectedRelevantScheduleNames.includes(scheduleName))

    return isSameLength && includesAll ? 'Matching' : 'Not Matching'
}
